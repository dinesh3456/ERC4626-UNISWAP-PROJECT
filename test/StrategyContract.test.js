const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StrategyContract", function () {
  let StrategyContract, strategy;
  let MockERC20, token0, token1, lpToken, rewardToken;
  let MockERC4626Vault, vault;
  let MockUniswapV2Factory, factory;
  let MockUniswapV2Router, router;
  let MockUniswapV2Pair, pair;
  let StakingContract, staking;
  let owner, user1, user2;

  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const DEPOSIT_AMOUNT = ethers.utils.parseEther("1000");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    MockERC20 = await ethers.getContractFactory("MockERC20");
    token0 = await MockERC20.deploy("Token0", "TK0");
    token1 = await MockERC20.deploy("Token1", "TK1");
    rewardToken = await MockERC20.deploy("Reward Token", "RWT");

    // Sort tokens
    let sortedTokens;
    if (token0.address.toLowerCase() < token1.address.toLowerCase()) {
      sortedTokens = [token0, token1];
    } else {
      sortedTokens = [token1, token0];
    }
    [token0, token1] = sortedTokens;

    // Deploy mock Uniswap contracts
    MockUniswapV2Factory = await ethers.getContractFactory(
      "MockUniswapV2Factory"
    );
    factory = await MockUniswapV2Factory.deploy(owner.address);

    // Deploy WETH (for testing purposes)
    const WETH = await MockERC20.deploy("Wrapped Ether", "WETH");

    MockUniswapV2Router = await ethers.getContractFactory(
      "MockUniswapV2Router"
    );
    router = await MockUniswapV2Router.deploy(factory.address, WETH.address);

    // Create pair
    await factory.createPair(token0.address, token1.address);
    const pairAddress = await factory.getPair(token0.address, token1.address);
    MockUniswapV2Pair = await ethers.getContractFactory("MockUniswapV2Pair");
    pair = await MockUniswapV2Pair.attach(pairAddress);
    lpToken = pair;

    // Deploy mock vault
    MockERC4626Vault = await ethers.getContractFactory("MockERC4626Vault");
    vault = await MockERC4626Vault.deploy(
      lpToken.address,
      "Vault LP Token",
      "vLPT"
    );

    // Deploy mock staking contract
    StakingContract = await ethers.getContractFactory("StakingContract");
    staking = await StakingContract.deploy(
      lpToken.address,
      rewardToken.address
    );

    // Deploy strategy contract
    StrategyContract = await ethers.getContractFactory("StrategyContract");
    strategy = await StrategyContract.deploy(
      vault.address,
      router.address,
      pair.address,
      token0.address,
      token1.address,
      rewardToken.address,
      staking.address
    );

    // Mint initial token supplies
    await token0.mint(user1.address, INITIAL_SUPPLY);
    await token1.mint(user1.address, INITIAL_SUPPLY);
    await token0.mint(user2.address, INITIAL_SUPPLY);
    await token1.mint(user2.address, INITIAL_SUPPLY);

    // Approve strategy to spend tokens
    await token0
      .connect(user1)
      .approve(strategy.address, ethers.constants.MaxUint256);
    await token1
      .connect(user1)
      .approve(strategy.address, ethers.constants.MaxUint256);
    await token0
      .connect(user2)
      .approve(strategy.address, ethers.constants.MaxUint256);
    await token1
      .connect(user2)
      .approve(strategy.address, ethers.constants.MaxUint256);

    // Mint reward tokens to the staking contract
    await rewardToken.mint(staking.address, INITIAL_SUPPLY);
  });

  describe("Deployment", function () {
    it("Should set the correct addresses", async function () {
      expect(await strategy.vault()).to.equal(vault.address);
      expect(await strategy.uniswapRouter()).to.equal(router.address);
      expect(await strategy.uniswapPair()).to.equal(pair.address);
      expect(await strategy.token0()).to.equal(token0.address);
      expect(await strategy.token1()).to.equal(token1.address);
      expect(await strategy.rewardToken()).to.equal(rewardToken.address);
      expect(await strategy.stakingContract()).to.equal(staking.address);
    });
  });

  describe("Deposit", function () {
    it("Should deposit tokens and receive LP tokens", async function () {
      await strategy.connect(user1).deposit(DEPOSIT_AMOUNT, DEPOSIT_AMOUNT);

      const userShares = await vault.balanceOf(user1.address);
      expect(userShares).to.be.gt(0);

      const strategyLPBalance = await lpToken.balanceOf(strategy.address);
      expect(strategyLPBalance).to.equal(0); // All LP tokens should be staked

      const stakedAmount = await staking.balanceOf(strategy.address);
      expect(stakedAmount).to.be.gt(0);
    });

    it("Should fail when deposit amount is zero", async function () {
      await expect(
        strategy.connect(user1).deposit(0, DEPOSIT_AMOUNT)
      ).to.be.revertedWith("Deposit amounts must be greater than 0");

      await expect(
        strategy.connect(user1).deposit(DEPOSIT_AMOUNT, 0)
      ).to.be.revertedWith("Deposit amounts must be greater than 0");
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      await strategy.connect(user1).deposit(DEPOSIT_AMOUNT, DEPOSIT_AMOUNT);
    });

    it("Should withdraw tokens and burn LP tokens", async function () {
      const initialBalance0 = await token0.balanceOf(user1.address);
      const initialBalance1 = await token1.balanceOf(user1.address);

      const userShares = await vault.balanceOf(user1.address);
      await strategy.connect(user1).withdraw(userShares);

      const finalBalance0 = await token0.balanceOf(user1.address);
      const finalBalance1 = await token1.balanceOf(user1.address);

      expect(finalBalance0).to.be.gt(initialBalance0);
      expect(finalBalance1).to.be.gt(initialBalance1);

      const remainingShares = await vault.balanceOf(user1.address);
      expect(remainingShares).to.equal(0);
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await strategy.connect(user1).deposit(DEPOSIT_AMOUNT, DEPOSIT_AMOUNT);
      // Simulate some time passing for rewards to accrue
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine");
    });

    it("Should allow users to claim rewards", async function () {
      const initialRewardBalance = await rewardToken.balanceOf(user1.address);
      await strategy.connect(user1).claimRewards();
      const finalRewardBalance = await rewardToken.balanceOf(user1.address);

      expect(finalRewardBalance).to.be.gt(initialRewardBalance);
    });

    it("Should reinvest rewards", async function () {
      const initialLPBalance = await staking.balanceOf(strategy.address);
      await strategy.reinvestRewards();
      const finalLPBalance = await staking.balanceOf(strategy.address);

      expect(finalLPBalance).to.be.gt(initialLPBalance);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to set slippage tolerance", async function () {
      await expect(
        strategy.connect(user1).setSlippageTolerance(100)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(strategy.setSlippageTolerance(100)).to.not.be.reverted;
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      await strategy.connect(user1).deposit(DEPOSIT_AMOUNT, DEPOSIT_AMOUNT);
    });

    it("Should allow owner to execute emergency withdraw", async function () {
      const initialBalance0 = await token0.balanceOf(owner.address);
      const initialBalance1 = await token1.balanceOf(owner.address);

      await strategy.emergencyWithdraw();

      const finalBalance0 = await token0.balanceOf(owner.address);
      const finalBalance1 = await token1.balanceOf(owner.address);

      expect(finalBalance0).to.be.gt(initialBalance0);
      expect(finalBalance1).to.be.gt(initialBalance1);
    });
  });
});
