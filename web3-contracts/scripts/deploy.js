const hre = require("hardhat");

async function main() {
  console.log("Iniciando despliegue seguro en Optimism Sepolia...");

  // 1. Obtener la cuenta del Deployer (la que pusiste en el .env)
  const [deployer] = await hre.ethers.getSigners();
  console.log("Desplegando contratos con la cuenta:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Saldo de la cuenta:", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
      console.error("ERROR: No tienes saldo en Optimism Sepolia. Ve a un Faucet para obtener ETH de prueba.");
      process.exit(1);
  }

  // 2. Desplegar el Smart Contract de WintonProtocol
  // NOTA: El deployer será el Owner y también lo configuramos como el Relayer inicial.
  console.log("Desplegando WintonProtocol...");
  const Protocol = await hre.ethers.getContractFactory("WintonProtocol");
  
  // Pasamos la dirección del deployer como Relayer
  const protocol = await Protocol.deploy(deployer.address);

  await protocol.waitForDeployment();
  const protocolAddress = await protocol.getAddress();

  console.log("\n✅ WintonProtocol desplegado con éxito!");
  console.log("👉 DIRECCIÓN DEL CONTRATO:", protocolAddress);
  console.log("\nGuarda esta dirección. La necesitarás en el backend de Render (WINTON_PROTOCOL_ADDRESS).");

  console.log("\nProceso finalizado. Si deseas verificar el contrato en Etherscan, ejecuta:");
  console.log(`npx hardhat verify --network optimismSepolia ${protocolAddress} ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
