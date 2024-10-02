// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC4626Vault.sol";
import "./StakingContract.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract StrategyContract is ReentrancyGuard, Ownable, Pausable {
    ERC4626Vault public vault;
    IUniswapV2Router02 public uniswapRouter;
    IUniswapV2Pair public uniswapPair;
    IERC20 public token0;
    IERC20 public token1;
    IERC20 public lpToken;
    StakingContract public stakingContract;
    IERC20 public rewardToken;

    uint256 public SLIPPAGE_TOLERANCE = 50; // 0.5%
    uint256 public constant DEADLINE_EXTENSION = 300; // 5 minutes

    event Deposited(address indexed user, uint256 amount0, uint256 amount1, uint256 lpAmount);
    event Withdrawn(address indexed user, uint256 shares, uint256 amount0, uint256 amount1);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsReinvested(uint256 rewardAmount, uint256 newLpAmount);

    constructor(
    address _vault,
    address _uniswapRouter,
    address _uniswapPair,
    address _token0,
    address _token1,
    address _rewardToken,
    address _stakingContract
) {
    require(_vault != address(0), "Invalid vault address");
    require(_uniswapRouter != address(0), "Invalid router address");
    require(_uniswapPair != address(0), "Invalid pair address");
    require(_token0 != address(0), "Invalid token0 address");
    require(_token1 != address(0), "Invalid token1 address");
    require(_rewardToken != address(0), "Invalid reward token address");
    require(_stakingContract != address(0), "Invalid staking contract address");

    vault = ERC4626Vault(_vault);
    uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    uniswapPair = IUniswapV2Pair(_uniswapPair);
    token0 = IERC20(_token0);
    token1 = IERC20(_token1);
    lpToken = IERC20(_uniswapPair);
    rewardToken = IERC20(_rewardToken);
    stakingContract = StakingContract(_stakingContract);

    (address token0Address, address token1Address) = _token0 < _token1 
        ? (_token0, _token1) 
        : (_token1, _token0);
    token0 = IERC20(token0Address);
    token1 = IERC20(token1Address);

    require(uniswapPair.token0() == address(token0) && uniswapPair.token1() == address(token1), "Invalid token pair");
}

    function deposit(uint256 amount0, uint256 amount1) external nonReentrant whenNotPaused {
    require(amount0 > 0 && amount1 > 0, "Deposit amounts must be greater than 0");

    token0.transferFrom(msg.sender, address(this), amount0);
    token1.transferFrom(msg.sender, address(this), amount1);

    token0.approve(address(uniswapRouter), amount0);
    token1.approve(address(uniswapRouter), amount1);

    uint256 minAmount0 = amount0 * (10000 - SLIPPAGE_TOLERANCE) / 10000;
    uint256 minAmount1 = amount1 * (10000 - SLIPPAGE_TOLERANCE) / 10000;

    (uint256 amountA, uint256 amountB, uint256 liquidity) = uniswapRouter.addLiquidity(
        address(token0),
        address(token1),
        amount0,
        amount1,
        minAmount0,
        minAmount1,
        address(this),
        block.timestamp + DEADLINE_EXTENSION
    );

    require(liquidity > 0, "No liquidity received");
    require(amountA >= minAmount0 && amountB >= minAmount1, "Slippage too high");

    stakeLPTokens(liquidity);

    vault.deposit(liquidity, msg.sender);

    emit Deposited(msg.sender, amountA, amountB, liquidity);
}

    function withdraw(uint256 shares) external nonReentrant whenNotPaused {
    require(shares > 0, "Shares must be greater than 0");

    uint256 lpAmount = vault.redeem(shares, address(this), msg.sender);
    require(lpAmount > 0, "No LP tokens to withdraw");

    unstakeLPTokens(lpAmount);

    require(lpToken.balanceOf(address(this)) >= lpAmount, "Insufficient LP tokens in contract");

    lpToken.approve(address(uniswapRouter), lpAmount);

    (uint256 reserveA, uint256 reserveB,) = uniswapPair.getReserves();
    uint256 totalSupply = uniswapPair.totalSupply();
    uint256 minAmount0 = lpAmount * reserveA / totalSupply * (10000 - SLIPPAGE_TOLERANCE) / 10000;
    uint256 minAmount1 = lpAmount * reserveB / totalSupply * (10000 - SLIPPAGE_TOLERANCE) / 10000;

    (uint256 amount0, uint256 amount1) = uniswapRouter.removeLiquidity(
        address(token0),
        address(token1),
        lpAmount,
        minAmount0,
        minAmount1,
        msg.sender,
        block.timestamp + DEADLINE_EXTENSION
    );

    require(amount0 >= minAmount0 && amount1 >= minAmount1, "Slippage too high");

    emit Withdrawn(msg.sender, shares, amount0, amount1);
}

    function getUserRewards(address user) external view returns (uint256) {
        uint256 userShares = vault.balanceOf(user);
        uint256 totalShares = vault.totalSupply();
        uint256 totalStaked = stakingContract.totalSupply();
        
        if (totalShares == 0) return 0;
        
        uint256 userStakedAmount = totalStaked * userShares / totalShares;
        return stakingContract.earned(address(this)) * userStakedAmount / totalStaked;
    }

    function claimRewards() external nonReentrant whenNotPaused {
        uint256 userShares = vault.balanceOf(msg.sender);
        uint256 totalShares = vault.totalSupply();
        require(userShares > 0, "No shares");
        
        uint256 beforeBalance = rewardToken.balanceOf(address(this));
        stakingContract.getReward();
        uint256 rewards = rewardToken.balanceOf(address(this)) - beforeBalance;
        
        uint256 userRewards = rewards * userShares / totalShares;
        require(userRewards > 0, "No rewards to claim");
        
        require(rewardToken.transfer(msg.sender, userRewards), "Reward transfer failed");

        emit RewardsClaimed(msg.sender, userRewards);
    }

    function reinvestRewards() external nonReentrant whenNotPaused {
        uint256 beforeBalance = rewardToken.balanceOf(address(this));
        stakingContract.getReward();
        uint256 rewardAmount = rewardToken.balanceOf(address(this)) - beforeBalance;
        require(rewardAmount > 0, "No rewards to reinvest");

        uint256 halfReward = rewardAmount / 2;
        rewardToken.approve(address(uniswapRouter), 0);
        rewardToken.approve(address(uniswapRouter), rewardAmount);

        address[] memory path0 = new address[](2);
        path0[0] = address(rewardToken);
        path0[1] = address(token0);
        uniswapRouter.swapExactTokensForTokens(
            halfReward,
            0,
            path0,
            address(this),
            block.timestamp + DEADLINE_EXTENSION
        );

        address[] memory path1 = new address[](2);
        path1[0] = address(rewardToken);
        path1[1] = address(token1);
        uniswapRouter.swapExactTokensForTokens(
            halfReward,
            0,
            path1,
            address(this),
            block.timestamp + DEADLINE_EXTENSION
        );

        uint256 token0Amount = token0.balanceOf(address(this));
        uint256 token1Amount = token1.balanceOf(address(this));
        token0.approve(address(uniswapRouter), 0);
        token1.approve(address(uniswapRouter), 0);
        token0.approve(address(uniswapRouter), token0Amount);
        token1.approve(address(uniswapRouter), token1Amount);

        (,, uint256 liquidity) = uniswapRouter.addLiquidity(
            address(token0),
            address(token1),
            token0Amount,
            token1Amount,
            0,
            0,
            address(this),
            block.timestamp + DEADLINE_EXTENSION
        );

        stakeLPTokens(liquidity);

        emit RewardsReinvested(rewardAmount, liquidity);
    }

    function stakeLPTokens(uint256 amount) internal {
        require(amount > 0, "Cannot stake 0 LP tokens");
        lpToken.approve(address(stakingContract), 0);
        lpToken.approve(address(stakingContract), amount);
        stakingContract.stake(amount);
    }

    function unstakeLPTokens(uint256 amount) internal {
        require(amount > 0, "Cannot unstake 0 LP tokens");
        stakingContract.withdraw(amount);
    }

    function setSlippageTolerance(uint256 _slippageTolerance) external onlyOwner {
        require(_slippageTolerance <= 500, "Slippage tolerance too high"); // Max 5%
        SLIPPAGE_TOLERANCE = _slippageTolerance;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 lpBalance = lpToken.balanceOf(address(this));
        if (lpBalance > 0) {
            unstakeLPTokens(lpBalance);
            lpToken.transfer(owner(), lpBalance);
        }

        uint256 token0Balance = token0.balanceOf(address(this));
        if (token0Balance > 0) {
            token0.transfer(owner(), token0Balance);
        }

        uint256 token1Balance = token1.balanceOf(address(this));
        if (token1Balance > 0) {
            token1.transfer(owner(), token1Balance);
        }

        uint256 rewardBalance = rewardToken.balanceOf(address(this));
        if (rewardBalance > 0) {
            rewardToken.transfer(owner(), rewardBalance);
        }
    }
}