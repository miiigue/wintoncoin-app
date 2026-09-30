// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev AVL ledger ordered by (dueAt, immutable id). Subtree aggregates allow
/// whole paid ranges to be detached without rewriting every historical lot.
/// Detached nodes are historical only: every public lookup checks reachability.
library CommitmentTree {
    struct Node {
        uint256 left;
        uint256 right;
        uint256 dueAt;
        uint256 amount;
        uint256 fee;
        uint256 margin;
        uint256 sum;
        uint256 marginSum;
        uint256 firstId;
        uint256 height;
    }
    struct Tree { uint256 root; mapping(uint256 => Node) nodes; }

    function _pull(Tree storage t, uint256 id) private {
        Node storage n = t.nodes[id];
        Node storage l = t.nodes[n.left];
        Node storage r = t.nodes[n.right];
        n.sum = l.sum + n.amount + r.sum;
        n.marginSum = l.marginSum + n.margin + r.marginSum;
        n.height = 1 + (l.height > r.height ? l.height : r.height);
        n.firstId = id;
        if (n.left != 0 && l.firstId < n.firstId) n.firstId = l.firstId;
        if (n.right != 0 && r.firstId < n.firstId) n.firstId = r.firstId;
    }
    function _rotateLeft(Tree storage t, uint256 a) private returns (uint256 b) {
        b = t.nodes[a].right;
        t.nodes[a].right = t.nodes[b].left;
        t.nodes[b].left = a;
        _pull(t,a); _pull(t,b);
    }
    function _rotateRight(Tree storage t, uint256 a) private returns (uint256 b) {
        b = t.nodes[a].left;
        t.nodes[a].left = t.nodes[b].right;
        t.nodes[b].right = a;
        _pull(t,a); _pull(t,b);
    }
    function _balance(Tree storage t, uint256 id) private returns (uint256) {
        _pull(t,id);
        Node storage n = t.nodes[id];
        if (t.nodes[n.left].height > t.nodes[n.right].height + 1) {
            Node storage l = t.nodes[n.left];
            if (t.nodes[l.right].height > t.nodes[l.left].height) n.left = _rotateLeft(t,n.left);
            return _rotateRight(t,id);
        }
        if (t.nodes[n.right].height > t.nodes[n.left].height + 1) {
            Node storage r = t.nodes[n.right];
            if (t.nodes[r.left].height > t.nodes[r.right].height) n.right = _rotateRight(t,n.right);
            return _rotateLeft(t,id);
        }
        return id;
    }
    function _earlier(Tree storage t, uint256 a, uint256 b) private view returns (bool) {
        return t.nodes[a].dueAt < t.nodes[b].dueAt ||
            (t.nodes[a].dueAt == t.nodes[b].dueAt && a < b);
    }
    function _insert(Tree storage t, uint256 root, uint256 id) private returns (uint256) {
        if(root == 0) return id;
        if(_earlier(t,id,root)) t.nodes[root].left = _insert(t,t.nodes[root].left,id);
        else t.nodes[root].right = _insert(t,t.nodes[root].right,id);
        return _balance(t,root);
    }
    function insert(Tree storage t, uint256 id, uint256 dueAt, uint256 amount, uint256 fee, uint256 margin) internal {
        require(id != 0 && amount > 0 && margin <= fee && fee <= amount, "Ledger: Invalid lot");
        t.nodes[id] = Node(0,0,dueAt,amount,fee,margin,amount,margin,id,1);
        t.root = _insert(t,t.root,id);
    }
    // Unlike a single rotation, this also handles a bulk-pruned side whose
    // height has fallen by more than one level.
    function _join(Tree storage t, uint256 left, uint256 pivot, uint256 right) private returns (uint256) {
        if(t.nodes[left].height > t.nodes[right].height + 1) {
            t.nodes[left].right = _join(t,t.nodes[left].right,pivot,right);
            return _balance(t,left);
        }
        if(t.nodes[right].height > t.nodes[left].height + 1) {
            t.nodes[right].left = _join(t,left,pivot,t.nodes[right].left);
            return _balance(t,right);
        }
        t.nodes[pivot].left = left; t.nodes[pivot].right = right;
        _pull(t,pivot);
        return pivot;
    }
    function _popFirst(Tree storage t, uint256 root) private returns (uint256 rest, uint256 first) {
        if(t.nodes[root].left == 0) return (t.nodes[root].right,root);
        (rest,first) = _popFirst(t,t.nodes[root].left);
        t.nodes[root].left = rest;
        return (_balance(t,root),first);
    }
    function _remove(Tree storage t, uint256 root, uint256 id) private returns (uint256) {
        require(root != 0, "Ledger: Missing lot");
        if(root == id) {
            uint256 left = t.nodes[root].left;
            uint256 right = t.nodes[root].right;
            if(right == 0) return left;
            (uint256 rest,uint256 pivot) = _popFirst(t,right);
            return _join(t,left,pivot,rest);
        }
        if(_earlier(t,id,root)) t.nodes[root].left = _remove(t,t.nodes[root].left,id);
        else t.nodes[root].right = _remove(t,t.nodes[root].right,id);
        return _balance(t,root);
    }
    function remove(Tree storage t, uint256 id) internal { t.root = _remove(t,t.root,id); }
    function contains(Tree storage t, uint256 id) internal view returns (bool) {
        uint256 root = t.root;
        while(root != 0) {
            if(root == id) return true;
            root = _earlier(t,id,root) ? t.nodes[root].left : t.nodes[root].right;
        }
        return false;
    }
    function balances(Tree storage t, uint256 id) internal view returns (uint256 amount, uint256 fee, uint256 margin) {
        if(!contains(t,id)) return (0,0,0);
        Node storage n = t.nodes[id];
        return (n.amount,n.fee,n.margin);
    }
    function matured(Tree storage t, uint256 timestamp) internal view returns (uint256 sum) {
        uint256 root = t.root;
        while(root != 0) {
            Node storage n = t.nodes[root];
            if(n.dueAt <= timestamp) { sum += t.nodes[n.left].sum + n.amount; root = n.right; }
            else root = n.left;
        }
    }
    function firstId(Tree storage t) internal view returns (uint256) { return t.nodes[t.root].firstId; }
    function _consume(Tree storage t, uint256 root, uint256 amount) private returns (uint256 rest, uint256 paidMargin) {
        if(amount == 0) return (root,0);
        Node storage n = t.nodes[root];
        if(amount == n.sum) return (0,n.marginSum);
        uint256 left = n.left;
        uint256 right = n.right;
        uint256 leftSum = t.nodes[left].sum;
        if(amount < leftSum) {
            (left,paidMargin) = _consume(t,left,amount);
            return (_join(t,left,root,right),paidMargin);
        }
        paidMargin = t.nodes[left].marginSum;
        amount -= leftSum;
        if(amount < n.amount) {
            uint256 paidFee = amount < n.fee ? amount : n.fee;
            uint256 margin = paidFee < n.margin ? paidFee : n.margin;
            n.amount -= amount; n.fee -= paidFee; n.margin -= margin;
            return (_join(t,0,root,right),paidMargin + margin);
        }
        paidMargin += n.margin;
        amount -= n.amount;
        uint256 rightMargin;
        (rest,rightMargin) = _consume(t,right,amount);
        return (rest,paidMargin + rightMargin);
    }
    function consume(Tree storage t, uint256 amount) internal returns (uint256 paidMargin) {
        require(amount <= t.nodes[t.root].sum, "Ledger: Amount exceeds commitments");
        (t.root,paidMargin) = _consume(t,t.root,amount);
    }
}
