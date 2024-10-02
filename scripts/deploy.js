// scripts/deploy.js

async function main() {
  // Get the contract factory for MockUniswapV2Router
  const MockUniswapV2Router = await ethers.getContractFactory(
    "MockUniswapV2Router"
  );

  // Deploy the MockUniswapV2Factory first
  const MockUniswapV2Factory = await ethers.getContractFactory(
    "MockUniswapV2Factory"
  );
  const factory = await MockUniswapV2Factory.deploy(/* feeToSetter address */);
  await factory.deployed();

  // Deploy WETH (for testing purposes)
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const WETH = await MockERC20.deploy("Wrapped Ether", "WETH");
  await WETH.deployed();

  // Deploy the MockUniswapV2Router
  const router = await MockUniswapV2Router.deploy(
    factory.address,
    WETH.address
  );
  await router.deployed();

  // Log the addresses of the deployed contracts
  console.log("MockUniswapV2Factory deployed to:", factory.address);
  console.log("WETH deployed to:", WETH.address);
  console.log("MockUniswapV2Router deployed to:", router.address);
}

// Execute the main function and handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
