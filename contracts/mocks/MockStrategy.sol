// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../StakingContract.sol";

contract MockStrategy {
    StakingContract public stakingContract;

    constructor(address _stakingContract) {
        stakingContract = StakingContract(_stakingContract);
    }

    function stake(uint256 amount) external {
        stakingContract.stake(amount);
    }

    function withdraw(uint256 amount) external {
        stakingContract.withdraw(amount);
    }

    function getReward() external {
        stakingContract.getReward();
    }
}