// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ERC4626Vault is ERC4626, Ownable, Pausable, ReentrancyGuard {
    uint256 public MAX_DEPOSIT_LIMIT = 1_000_000 * 1e18; // 1 million tokens
    uint256 public MAX_MINT_LIMIT = 1_000_000 * 1e18; // 1 million tokens
    uint256 private _totalAssets;


    event DepositLimitUpdated(uint256 newLimit);
    event MintLimitUpdated(uint256 newLimit);
    event TotalAssetsUpdated(uint256 newTotalAssets);


    constructor(IERC20 asset_, string memory name_, string memory symbol_) 
        ERC4626(asset_) 
        ERC20(name_, symbol_)
    {}

    function totalAssets() public view virtual override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    // This function is mentioned here in case we need to add any additional logic.
    function updateTotalAssets() external onlyOwner {
        uint256 currentBalance = IERC20(asset()).balanceOf(address(this));
        if (currentBalance != _totalAssets) {
            _totalAssets = currentBalance;
            emit TotalAssetsUpdated(_totalAssets);
    }
}

    function deposit(uint256 assets, address receiver) public virtual override whenNotPaused nonReentrant returns (uint256) {
        require(assets <= MAX_DEPOSIT_LIMIT, "Deposit amount exceeds limit");
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public virtual override whenNotPaused nonReentrant returns (uint256) {
        require(shares <= MAX_MINT_LIMIT, "Mint amount exceeds limit");
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public virtual override whenNotPaused nonReentrant returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public virtual override whenNotPaused nonReentrant returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }

    function setDepositLimit(uint256 newLimit) external onlyOwner {
        require(newLimit > 0, "Deposit limit must be greater than 0");
        MAX_DEPOSIT_LIMIT = newLimit;
        emit DepositLimitUpdated(newLimit);
    }

    function setMintLimit(uint256 newLimit) external onlyOwner {
        require(newLimit > 0, "Mint limit must be greater than 0");
        MAX_MINT_LIMIT = newLimit;
        emit MintLimitUpdated(newLimit);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 assetBalance = IERC20(asset()).balanceOf(address(this));
        if (assetBalance > 0) {
            IERC20(asset()).transfer(owner(), assetBalance);
        }
    }
}