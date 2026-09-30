// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Groups of 32 keep independent timestamps and amounts. A live bit
/// permits consuming positions without rewriting every historical record.
library ParkingLedger {
    uint256 private constant WIDTH=32;
    struct Lot { uint256 amount; uint256 releaseAt; }
    struct Group { uint256 sum; uint256 live; uint256 minRelease; uint256 maxRelease; }
    struct Tree { Lot[] lots; Group[] groups; uint256 headGroup; uint256 tracked; }
    function append(Tree storage t,uint256 index,uint256 amount,uint256 releaseTime) internal {
        require(index==t.lots.length,"Parking: Invalid index");
        t.lots.push(Lot(amount,releaseTime));
        uint256 group=index/WIDTH;
        if(index%WIDTH==0)t.groups.push();
        if(amount==0)return;
        if(t.tracked==0)t.headGroup=group;
        Group storage g=t.groups[group];
        if(g.live==0) {g.minRelease=releaseTime;g.maxRelease=releaseTime;}
        else {if(releaseTime<g.minRelease)g.minRelease=releaseTime;if(releaseTime>g.maxRelease)g.maxRelease=releaseTime;}
        g.live|=uint256(1)<<(index%WIDTH);g.sum+=amount;t.tracked+=amount;
    }
    function count(Tree storage t) internal view returns(uint256) { return t.lots.length; }
    function releaseAt(Tree storage t,uint256 index) internal view returns(uint256) { return t.lots[index].releaseAt; }
    function total(Tree storage t) internal view returns(uint256) { return t.tracked; }
    function balance(Tree storage t,uint256 index) internal view returns(uint256) {
        require(index<t.lots.length,"Parking: Unknown index");
        return t.groups[index/WIDTH].live&(uint256(1)<<(index%WIDTH))==0?0:t.lots[index].amount;
    }
    function first(Tree storage t,uint256 length) internal view returns(uint256) {
        if(t.tracked==0)return length;
        uint256 mask=t.groups[t.headGroup].live;
        for(uint256 bit;bit<WIDTH;bit++)if(mask&(uint256(1)<<bit)!=0)return t.headGroup*WIDTH+bit;
        revert("Parking: Head mismatch");
    }
    function _advance(Tree storage t) private {
        uint256 head=t.headGroup;
        while(head<t.groups.length && t.groups[head].live==0)head++;
        t.headGroup=head;
    }
    function locked(Tree storage t,uint256 timestamp) internal view returns(uint256 sum) {
        for(uint256 group=t.headGroup;group<t.groups.length;group++) {
            Group storage g=t.groups[group];uint256 mask=g.live;
            if(mask==0 || g.maxRelease<=timestamp)continue;
            if(g.minRelease>timestamp){sum+=g.sum;continue;}
            for(uint256 bit;bit<WIDTH;bit++)if(mask&(uint256(1)<<bit)!=0) {
                Lot storage lot=t.lots[group*WIDTH+bit];
                if(lot.releaseAt>timestamp)sum+=lot.amount;
            }
        }
    }
    function consume(Tree storage t,uint256 amount,bool onlyMatured,uint256 timestamp) internal returns(uint256 spent) {
        for(uint256 group=t.headGroup;group<t.groups.length && spent<amount;group++) {
            Group storage g=t.groups[group];
            if(g.live==0 || (onlyMatured && g.minRelease>timestamp))continue;
            uint256 used;
            if((!onlyMatured || g.maxRelease<=timestamp) && g.sum<=amount-spent) {
                used=g.sum;g.live=0;g.sum=0;
            } else used=_consumeGroup(t,group,amount-spent,onlyMatured,timestamp);
            spent+=used;
        }
        t.tracked-=spent;_advance(t);
    }
    function _consumeGroup(Tree storage t,uint256 group,uint256 amount,bool mature,uint256 timestamp) private returns(uint256 spent) {
        Group storage g=t.groups[group];uint256 mask=g.live;
        for(uint256 bit;bit<WIDTH && spent<amount;bit++) {
            uint256 flag=uint256(1)<<bit;
            if(mask&flag==0)continue;
            Lot storage lot=t.lots[group*WIDTH+bit];
            if(mature && lot.releaseAt>timestamp)continue;
            uint256 needed=amount-spent;
            if(needed>=lot.amount){spent+=lot.amount;mask&=~flag;}
            else {lot.amount-=needed;spent+=needed;}
        }
        g.live=mask;g.sum-=spent;
    }
    function erase(Tree storage t,uint256 index) internal {
        uint256 value=balance(t,index);if(value==0)return;
        Group storage g=t.groups[index/WIDTH];g.sum-=value;g.live&=~(uint256(1)<<(index%WIDTH));t.tracked-=value;_advance(t);
    }
}
