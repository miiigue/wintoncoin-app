const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

async function main() {
  console.log("Iniciando transferencia de Ownership al Relayer (Backend)...");

  // Leer el .env del backend para obtener las direcciones reales
  const backendEnvPath = path.resolve(__dirname, "../../backend/.env");
  if (fs.existsSync(backendEnvPath)) {
      const envConfig = dotenv.parse(fs.readFileSync(backendEnvPath));
      for (const k in envConfig) {
          process.env[k] = envConfig[k];
      }
      console.log("✅ Archivo .env del backend cargado exitosamente.");
  } else {
      console.warn("⚠️ No se encontró el .env del backend en:", backendEnvPath);
  }

  // Obtener la cuenta del Deployer (la que tiene los permisos actuales)
  const [deployer] = await hre.ethers.getSigners();
  console.log("Ejecutando con Billetera Deployer:", deployer.address);

  const protocolAddress = process.env.WINTON_PROTOCOL_ADDRESS;
  const treasuryAddress = process.env.WINTON_TREASURY_ADDRESS;
  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  
  if (!protocolAddress || !treasuryAddress || !relayerPrivateKey) {
      console.error("❌ Faltan variables en el .env del backend (PROTOCOL, TREASURY o RELAYER_PK).");
      process.exit(1);
  }

  // Obtener la dirección pública del Relayer a partir de su llave privada
  const relayerAddress = new hre.ethers.Wallet(relayerPrivateKey).address;

  console.log("\nDestino (Billetera Relayer):", relayerAddress);
  console.log("Contrato Protocolo:", protocolAddress);
  console.log("Contrato Treasury:", treasuryAddress);

  // 1. Transferir WintonProtocol
  console.log("\n--- Transferencia WintonProtocol ---");
  const Protocol = await hre.ethers.getContractAt("WintonProtocol", protocolAddress);
  
  const currentProtocolOwner = await Protocol.owner();
  console.log("Propietario actual del Protocolo:", currentProtocolOwner);

  if (currentProtocolOwner.toLowerCase() === relayerAddress.toLowerCase()) {
    console.log("Protocolo YA pertenece al Relayer.");
  } else if (currentProtocolOwner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("Transfiriendo Ownership del Protocolo...");
    const tx1 = await Protocol.transferOwnership(relayerAddress);
    await tx1.wait();
    console.log("✅ WintonProtocol transferido exitosamente.");
  } else {
    console.log("⚠️ El Deployer actual no es el propietario del Protocolo.");
  }

  // 2. Transferir WintonTreasury
  if (treasuryAddress !== "INGRESA_TU_TREASURY_ADDRESS_AQUI") {
      const Treasury = await hre.ethers.getContractAt("WintonTreasury", treasuryAddress);
      const currentTreasuryOwner = await Treasury.owner();
      console.log("Propietario actual del Treasury:", currentTreasuryOwner);

      if (currentTreasuryOwner.toLowerCase() === relayerAddress.toLowerCase()) {
        console.log("Treasury YA pertenece al Relayer.");
      } else if (currentTreasuryOwner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("Transfiriendo Ownership del Treasury...");
        const tx2 = await Treasury.transferOwnership(relayerAddress);
        await tx2.wait();
        console.log("✅ WintonTreasury transferido exitosamente.");
      } else {
        console.log("⚠️ El Deployer actual no es el propietario del Treasury.");
      }
  } else {
      console.log("⚠️ No se proporcionó WINTON_TREASURY_ADDRESS, saltando Treasury.");
  }

  console.log("\n🚀 Transferencia completada. El sistema de Gobernanza ya puede controlar los Smart Contracts.");
}

main().catch((error) => {
  console.error("Error crítico:", error);
  process.exitCode = 1;
});
