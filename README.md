# ERC-4626 Uniswap Project Documentation

## Overview

The ERC-4626 Uniswap project implements a vault that adheres to the ERC-4626 standard, which is a tokenized vault standard for yield-bearing assets. This project integrates with Uniswap to facilitate liquidity provision and asset management.

## Project Structure

```
erc4626-uniswap-project/
├── contracts/
│   ├── ERC4626Vault.sol
│   ├── StrategyContract.sol
│   ├── StakingContract.sol
│   └── mocks/
│       ├── MockERC20.sol
│       ├── MockERC4626Vault.sol
│       ├── MockStrategy.sol
│       ├── MockUniswapV2Factory.sol
│       ├── MockUniswapV2Pair.sol
│       └── MockUniswapV2Router.sol
├── interfaces/
│   ├── IUniswapV2Factory.sol
│   ├── IUniswapV2Pair.sol
│   └── IUniswapV2Router02.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── Integration.test.js
├── package.json
├── README.md
└── .gitignore
```

## Contracts

### 1. ERC4626Vault.sol

This contract implements the ERC-4626 standard for a vault that allows users to deposit assets and receive shares in return. It integrates with Uniswap for liquidity management.

### 2. StrategyContract.sol

This contract defines the strategy for managing assets within the vault, including depositing and withdrawing from Uniswap pools.

### 3. StakingContract.sol

This contract manages the staking of assets, allowing users to earn rewards for providing liquidity.

### 4. Mocks

The `mocks` directory contains mock contracts for testing purposes:

- **MockERC20.sol**: A mock implementation of the ERC20 token.
- **MockERC4626Vault.sol**: A mock implementation of the ERC4626 vault.
- **MockStrategy.sol**: A mock strategy for testing.
- **MockUniswapV2Factory.sol**: A mock factory for creating Uniswap pairs.
- **MockUniswapV2Pair.sol**: A mock implementation of a Uniswap pair.
- **MockUniswapV2Router.sol**: A mock implementation of the Uniswap router.

## Interfaces

The `interfaces` directory contains the interfaces for interacting with Uniswap:

- **IUniswapV2Factory.sol**: Interface for the Uniswap factory contract.
- **IUniswapV2Pair.sol**: Interface for the Uniswap pair contract.
- **IUniswapV2Router02.sol**: Interface for the Uniswap router contract.

## Deployment

The deployment script is located in `scripts/deploy.js`. This script handles the deployment of the contracts to the Ethereum network.

## Testing

Integration tests are located in `test/Integration.test.js`. These tests ensure that the contracts interact correctly and that the overall functionality of the vault and its strategies work as intended.

## Dependencies

The project uses several dependencies, as specified in `package.json`:

- **@nomiclabs/hardhat-ethers**: For Ethereum development.
- **@nomiclabs/hardhat-waffle**: For testing and deploying smart contracts.
- **@openzeppelin/contracts**: For reusable smart contract components.
- **chai**: For assertions in tests.
- **ethereum-waffle**: For testing Ethereum smart contracts.
- **ethers**: For interacting with the Ethereum blockchain.
- **hardhat**: A development environment for Ethereum.

## License

This project is licensed under the ISC License.

## Getting Started

To get started with the project:

1. Clone the repository.
2. Install dependencies using `npm install`.
3. Deploy the contracts using the deployment script.
4. Run tests using `npx hardhat test`.

## Conclusion

This documentation provides an overview of the ERC-4626 Uniswap project, its structure, and how to interact with it. For further details, refer to the individual contract files and the README.md for additional context.
