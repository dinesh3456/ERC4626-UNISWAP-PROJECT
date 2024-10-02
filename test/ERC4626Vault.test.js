const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ERC4626Vault", function () {
  async function deployVaultFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const asset = await MockERC20.deploy("Mock Token", "MTK");
    await asset.deployed();

    const ERC4626Vault = await ethers.getContractFactory("ERC4626Vault");
    const vault = await ERC4626Vault.deploy(
      asset.address,
      "Vault Token",
      "vMTK"
    );
    await vault.deployed();

    // Mint some tokens to addr1 and addr2
    const mintAmount = ethers.utils.parseEther("1000000");
    await asset.mint(addr1.address, mintAmount);
    await asset.mint(addr2.address, mintAmount);

    // Approve vault to spend tokens
    await asset
      .connect(addr1)
      .approve(vault.address, ethers.constants.MaxUint256);
    await asset
      .connect(addr2)
      .approve(vault.address, ethers.constants.MaxUint256);

    return { vault, asset, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right asset", async function () {
      const { vault, asset } = await loadFixture(deployVaultFixture);
      expect(await vault.asset()).to.equal(asset.address);
    });

    it("Should set the right name and symbol", async function () {
      const { vault } = await loadFixture(deployVaultFixture);
      expect(await vault.name()).to.equal("Vault Token");
      expect(await vault.symbol()).to.equal("vMTK");
    });
  });

  describe("Deposits", function () {
    it("Should allow deposits and mint correct shares", async function () {
      const { vault, asset, addr1 } = await loadFixture(deployVaultFixture);
      const depositAmount = ethers.utils.parseEther("100");

      await expect(vault.connect(addr1).deposit(depositAmount, addr1.address))
        .to.emit(vault, "Deposit")
        .withArgs(addr1.address, addr1.address, depositAmount, depositAmount);

      expect(await vault.balanceOf(addr1.address)).to.equal(depositAmount);
      expect(await vault.totalAssets()).to.equal(depositAmount);
    });

    it("Should fail when deposit exceeds limit", async function () {
      const { vault, addr1 } = await loadFixture(deployVaultFixture);
      const excessiveAmount = ethers.utils.parseEther("1000001"); // Assuming MAX_DEPOSIT_LIMIT is 1,000,000

      await expect(
        vault.connect(addr1).deposit(excessiveAmount, addr1.address)
      ).to.be.revertedWith("Deposit amount exceeds limit");
    });
  });

  describe("Withdrawals", function () {
    it("Should allow withdrawals and burn correct shares", async function () {
      const { vault, asset, addr1 } = await loadFixture(deployVaultFixture);
      const depositAmount = ethers.utils.parseEther("100");
      await vault.connect(addr1).deposit(depositAmount, addr1.address);

      const withdrawAmount = ethers.utils.parseEther("50");
      await expect(
        vault
          .connect(addr1)
          .withdraw(withdrawAmount, addr1.address, addr1.address)
      )
        .to.emit(vault, "Withdraw")
        .withArgs(
          addr1.address,
          addr1.address,
          addr1.address,
          withdrawAmount,
          withdrawAmount
        );

      expect(await vault.balanceOf(addr1.address)).to.equal(
        depositAmount.sub(withdrawAmount)
      );
      expect(await vault.totalAssets()).to.equal(
        depositAmount.sub(withdrawAmount)
      );
    });

    it("Should fail when trying to withdraw more than balance", async function () {
      const { vault, addr1 } = await loadFixture(deployVaultFixture);
      const depositAmount = ethers.utils.parseEther("100");
      await vault.connect(addr1).deposit(depositAmount, addr1.address);

      const excessiveWithdrawAmount = ethers.utils.parseEther("101");
      await expect(
        vault
          .connect(addr1)
          .withdraw(excessiveWithdrawAmount, addr1.address, addr1.address)
      ).to.be.reverted;
    });
  });

  describe("Asset conversions", function () {
    it("Should correctly convert between assets and shares", async function () {
      const { vault, addr1 } = await loadFixture(deployVaultFixture);
      const assets = ethers.utils.parseEther("100");

      const shares = await vault.convertToShares(assets);
      expect(await vault.convertToAssets(shares)).to.equal(assets);
    });
  });

  describe("Max operations", function () {
    it("Should return correct maxDeposit", async function () {
      const { vault, addr1 } = await loadFixture(deployVaultFixture);
      const maxDeposit = await vault.maxDeposit(addr1.address);
      expect(maxDeposit).to.equal(ethers.constants.MaxUint256);
    });

    it("Should return correct maxMint", async function () {
      const { vault, addr1 } = await loadFixture(deployVaultFixture);
      const maxMint = await vault.maxMint(addr1.address);
      expect(maxMint).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to pause", async function () {
      const { vault, addr1 } = await loadFixture(deployVaultFixture);
      await expect(vault.connect(addr1).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(vault.pause()).not.to.be.reverted;
    });

    it("Should prevent deposits when paused", async function () {
      const { vault, addr1 } = await loadFixture(deployVaultFixture);
      await vault.pause();
      await expect(
        vault.connect(addr1).deposit(100, addr1.address)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Emergency functions", function () {
    it("Should allow owner to execute emergencyWithdraw", async function () {
      const { vault, asset, owner, addr1 } = await loadFixture(
        deployVaultFixture
      );
      const depositAmount = ethers.utils.parseEther("100");
      await vault.connect(addr1).deposit(depositAmount, addr1.address);

      await expect(() => vault.emergencyWithdraw()).to.changeTokenBalance(
        asset,
        owner,
        depositAmount
      );
    });
  });
});
