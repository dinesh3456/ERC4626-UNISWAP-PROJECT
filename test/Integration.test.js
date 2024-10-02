const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration Tests", function () {
  let StrategyContract, strategy;
  let ERC4626Vault, vault;
  let MockERC20, token0, token1, lpToken, rewardToken;
  let MockUniswapV2Factory, factory;
  let MockUniswapV2Router, router;
  let MockUniswapV2Pair, pair;
  let owner, user1, user2;

  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const DEPOSIT_AMOUNT = ethers.utils.parseEther("1000");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    MockERC20 = await ethers.getContractFactory("MockERC20");
    token0 = await MockERC20.deploy("Token0", "TK0");
    token1 = await MockERC20.deploy("Token1", "TK1");
    lpToken = await MockERC20.deploy("LP Token", "LPT");
    rewardToken = await MockERC20.deploy("Reward Token", "RWT");

    // Deploy mock Uniswap contracts
    MockUniswapV2Factory = await ethers.getContractFactory(
      "MockUniswapV2Factory"
    );
    factory = await MockUniswapV2Factory.deploy();

    MockUniswapV2Router = await ethers.getContractFactory(
      "MockUniswapV2Router"
    );
    router = await MockUniswapV2Router.deploy(factory.address);

    // Create pair
    await factory.createPair(token0.address, token1.address);
    const pairAddress = await factory.getPair(token0.address, token1.address);
    MockUniswapV2Pair = await ethers.getContractFactory("MockUniswapV2Pair");
    pair = await MockUniswapV2Pair.attach(pairAddress);

    // Deploy ERC4626Vault
    ERC4626Vault = await ethers.getContractFactory("ERC4626Vault");
    vault = await ERC4626Vault.deploy(
      lpToken.address,
      "Vault LP Token",
      "vLPT"
    );

    // Deploy StrategyContract
    StrategyContract = await ethers.getContractFactory("StrategyContract");
    strategy = await StrategyContract.deploy(
      vault.address,
      router.address,
      pair.address,
      token0.address,
      token1.address,
      rewardToken.address
    );

    // Setup initial state
    await token0.mint(user1.address, INITIAL_SUPPLY);
    await token1.mint(user1.address, INITIAL_SUPPLY);
    await token0.mint(user2.address, INITIAL_SUPPLY);
    await token1.mint(user2.address, INITIAL_SUPPLY);
    await token0.mint(router.address, INITIAL_SUPPLY);
    await token1.mint(router.address, INITIAL_SUPPLY);
    await lpToken.mint(router.address, INITIAL_SUPPLY);
    await rewardToken.mint(strategy.address, INITIAL_SUPPLY);

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

    // Approve router to spend LP tokens
    await lpToken.approve(router.address, ethers.constants.MaxUint256);
  });

  it("Should allow full deposit, stake, earn, and withdraw cycle", async function () {
    // Deposit
    await strategy.connect(user1).deposit(DEPOSIT_AMOUNT, DEPOSIT_AMOUNT);
    expect(await vault.balanceOf(user1.address)).to.be.gt(0);

    // Simulate time passing and rewards accumulating
    await time.increase(3600); // 1 hour

    // Claim rewards
    await strategy.connect(user1).claimRewards();
    expect(await rewardToken.balanceOf(user1.address)).to.be.gt(0);

    // Withdraw
    const userShares = await vault.balanceOf(user1.address);
    await strategy.connect(user1).withdraw(userShares);
    expect(await vault.balanceOf(user1.address)).to.equal(0);
  });
});
