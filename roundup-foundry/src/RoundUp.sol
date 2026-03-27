// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract RoundUp {
    address public owner;

    struct Investment {
        address user;
        uint256 amount;
        uint256 timestamp;
    }

    Investment[] public investments;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public investmentCount;

    event Invested(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function invest() external payable {
        require(msg.value > 0, "Must send MON");
        balances[msg.sender] += msg.value;
        investmentCount[msg.sender]++;
        investments.push(Investment({
            user: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));
        emit Invested(msg.sender, msg.value, block.timestamp);
    }

    function getMyBalance() external view returns (uint256) {
        return balances[msg.sender];
    }

    function getMyInvestmentCount() external view returns (uint256) {
        return investmentCount[msg.sender];
    }

    function getTotalInvestments() external view returns (uint256) {
        return investments.length;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        balances[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }
}
