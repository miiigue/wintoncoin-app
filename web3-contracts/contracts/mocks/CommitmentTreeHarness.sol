// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../libraries/CommitmentTree.sol";
contract CommitmentTreeHarness {
    using CommitmentTree for CommitmentTree.Tree;
    CommitmentTree.Tree private tree;
    function insert(uint256 id,uint256 due,uint256 amount,uint256 fee,uint256 margin) external { tree.insert(id,due,amount,fee,margin); }
    function move(uint256 id,uint256 due,uint256 amount,uint256 fee,uint256 margin) external { tree.remove(id); tree.insert(id,due,amount,fee,margin); }
    function consume(uint256 amount) external returns(uint256) { return tree.consume(amount); }
    function balances(uint256 id) external view returns(uint256,uint256,uint256) { return tree.balances(id); }
    function matured(uint256 timestamp) external view returns(uint256) { return tree.matured(timestamp); }
    function firstId() external view returns(uint256) { return tree.firstId(); }
    struct Summary { uint256 sum; uint256 margin; uint256 height; uint256 first; }
    function check() external view returns(Summary memory) { return _check(tree.root,0,0); }
    function _less(uint256 a,uint256 b) private view returns(bool) { return tree.nodes[a].dueAt<tree.nodes[b].dueAt || (tree.nodes[a].dueAt==tree.nodes[b].dueAt && a<b); }
    function _check(uint256 id,uint256 lower,uint256 upper) private view returns(Summary memory s) {
        if(id==0)return s;
        require((lower==0 || _less(lower,id)) && (upper==0 || _less(id,upper)),"order");
        CommitmentTree.Node storage n=tree.nodes[id];
        Summary memory l=_check(n.left,lower,id);
        Summary memory r=_check(n.right,id,upper);
        s.sum=l.sum+r.sum+n.amount; s.margin=l.margin+r.margin+n.margin;
        s.height=1+(l.height>r.height?l.height:r.height); s.first=id;
        if(l.first!=0 && l.first<s.first)s.first=l.first;
        if(r.first!=0 && r.first<s.first)s.first=r.first;
        require(l.height<=r.height+1 && r.height<=l.height+1,"balance");
        require(n.sum==s.sum && n.marginSum==s.margin && n.height==s.height && n.firstId==s.first,"aggregate");
        require(n.amount>0 && n.margin<=n.fee && n.fee<=n.amount,"amount");
    }
}
