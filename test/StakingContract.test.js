const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");

describe("StakingContract", function () {
  async function deployStakingFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const lpToken = await MockERC20.deploy("LP Token", "LPT");
    const rewardToken = await MockERC20.deploy("Reward Token", "RWT");

    const StakingContract = await ethers.getContractFactory("StakingContract");
    const staking = await StakingContract.deploy(
      lpToken.address,
      rewardToken.address
    );

    // Mint some tokens to addr1 and addr2
    const mintAmount = ethers.utils.parseEther("1000");
    await lpToken.mint(addr1.address, mintAmount);
    await lpToken.mint(addr2.address, mintAmount);

    // Approve staking contract to spend LP tokens
    await lpToken
      .connect(addr1)
      .approve(staking.address, ethers.constants.MaxUint256);
    await lpToken
      .connect(addr2)
      .approve(staking.address, ethers.constants.MaxUint256);

    // Mint reward tokens to the staking contract
    await rewardToken.mint(staking.address, ethers.utils.parseEther("10000"));

    return { staking, lpToken, rewardToken, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right LP token", async function () {
      const { staking, lpToken } = await loadFixture(deployStakingFixture);
      expect(await staking.lpToken()).to.equal(lpToken.address);
    });

    it("Should set the right reward token", async function () {
      const { staking, rewardToken } = await loadFixture(deployStakingFixture);
      expect(await staking.rewardToken()).to.equal(rewardToken.address);
    });
  });

  describe("Staking", function () {
    it("Should allow staking and update user balance", async function () {
      const { staking, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.utils.parseEther("100");

      await expect(staking.connect(addr1).stake(stakeAmount))
        .to.emit(staking, "Staked")
        .withArgs(addr1.address, stakeAmount);

      expect(await staking.balanceOf(addr1.address)).to.equal(stakeAmount);
      expect(await staking.totalSupply()).to.equal(stakeAmount);
    });

    it("Should fail when staking 0 amount", async function () {
      const { staking, addr1 } = await loadFixture(deployStakingFixture);
      await expect(staking.connect(addr1).stake(0)).to.be.revertedWith(
        "Cannot stake 0"
      );
    });
  });

  describe("Withdrawing", function () {
    it("Should allow withdrawing and update user balance", async function () {
      const { staking, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.utils.parseEther("100");
      await staking.connect(addr1).stake(stakeAmount);

      const withdrawAmount = ethers.utils.parseEther("50");
      await expect(staking.connect(addr1).withdraw(withdrawAmount))
        .to.emit(staking, "Withdrawn")
        .withArgs(addr1.address, withdrawAmount);

      expect(await staking.balanceOf(addr1.address)).to.equal(
        stakeAmount.sub(withdrawAmount)
      );
      expect(await staking.totalSupply()).to.equal(
        stakeAmount.sub(withdrawAmount)
      );
    });

    it("Should fail when withdrawing more than staked", async function () {
      const { staking, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.utils.parseEther("100");
      await staking.connect(addr1).stake(stakeAmount);

      const excessiveWithdrawAmount = ethers.utils.parseEther("101");
      await expect(staking.connect(addr1).withdraw(excessiveWithdrawAmount)).to
        .be.reverted;
    });
  });

  describe("Rewards", function () {
    it("Should accumulate rewards over time", async function () {
      const { staking, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.utils.parseEther("100");
      await staking.connect(addr1).stake(stakeAmount);

      await staking.setRewardRate(ethers.utils.parseEther("1")); // 1 token per second

      await time.increase(3600); // 1 hour

      const earnedRewards = await staking.earned(addr1.address);
      expect(earnedRewards).to.be.closeTo(
        ethers.utils.parseEther("3600"),
        ethers.utils.parseEther("1")
      );
    });

    it("Should allow claiming rewards", async function () {
      const { staking, rewardToken, addr1 } = await loadFixture(
        deployStakingFixture
      );
      const stakeAmount = ethers.utils.parseEther("100");
      await staking.connect(addr1).stake(stakeAmount);

      await staking.setRewardRate(ethers.utils.parseEther("1")); // 1 token per second

      await time.increase(3600); // 1 hour

      const initialBalance = await rewardToken.balanceOf(addr1.address);

      // Call getReward without checking the event
      await staking.connect(addr1).getReward();

      const finalBalance = await rewardToken.balanceOf(addr1.address);
      const rewardReceived = finalBalance.sub(initialBalance);

      // Check the actual balance change
      const expectedReward = ethers.utils.parseEther("3600");
      const marginOfError = ethers.utils.parseEther("5"); // Allow for a small margin of error
      expect(rewardReceived).to.be.closeTo(expectedReward, marginOfError);
    });
  });
});
