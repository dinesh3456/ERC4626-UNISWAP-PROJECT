// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract StakingContract is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public lpToken;
    IERC20 public rewardToken;
    address public strategyContract;

    uint256 public constant REWARD_PRECISION = 1e18;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) private _balances;
    uint256 private _totalSupply;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRate);

    constructor(IERC20 _lpToken, IERC20 _rewardToken) {
        require(address(_lpToken) != address(0), "Invalid LP token address");
        require(address(_rewardToken) != address(0), "Invalid reward token address");
        lpToken = _lpToken;
        rewardToken = _rewardToken;
        strategyContract = msg.sender;
    }

    
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function setRewardRate(uint256 _rewardRate) external onlyOwner {
        require(_rewardRate > 0, "Reward rate must be greater than 0");
        rewardRate = _rewardRate;
        emit RewardRateUpdated(_rewardRate);
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                block.timestamp
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(REWARD_PRECISION)
                    .div(_totalSupply)
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            _balances[account]
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(REWARD_PRECISION)
                .add(rewards[account]);
    }

    function stake(uint256 amount) external updateReward(msg.sender) whenNotPaused nonReentrant {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        lpToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public updateReward(msg.sender) whenNotPaused nonReentrant {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        lpToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public updateReward(msg.sender) whenNotPaused nonReentrant {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external whenNotPaused {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 lpBalance = lpToken.balanceOf(address(this));
        if (lpBalance > 0) {
            lpToken.safeTransfer(owner(), lpBalance);
        }

        uint256 rewardBalance = rewardToken.balanceOf(address(this));
        if (rewardBalance > 0) {
            rewardToken.safeTransfer(owner(), rewardBalance);
        }
    }
}