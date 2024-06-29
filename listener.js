const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Global constants for contract addresses and ABI paths
const WALLET = '12f23a131783385a50219e2e473218362acda165ac5f6d96ad1442722c066a71';
const MAINNET_ADDRESS = '0xb6e2c33c4A1D17ae596f92ed109cb998440e7b03';
const TESTNET_CONTRACT_ADDRESS = '0x7c9a3a87433980097465cc271b945fa2c073a77b';
const TESTNET_ABI_PATH = path.resolve(__dirname, 'testnetContractABI.json');

// Set up provider for Arbitrum mainnet using QuickNode
const mainnetProvider = new ethers.providers.JsonRpcProvider('https://omniscient-delicate-yard.arbitrum-mainnet.quiknode.pro/4dbe9e2dabf68eb5a9d7c9615109b7fa5d86d4d3/');

// Set up provider for Arbitrum testnet using QuickNode
const testnetProvider = new ethers.providers.JsonRpcProvider('https://intensive-spring-dawn.arbitrum-sepolia.quiknode.pro/49ceb1af8d85197f6ef77216719e3dedb320c952/');
const wallet = new ethers.Wallet(WALLET, testnetProvider);

// Load the testnet ABI
const testnetContractAbi = JSON.parse(fs.readFileSync(TESTNET_ABI_PATH, 'utf8'));

// Track the last processed block number
let lastProcessedBlock = 0;

// Function to trigger the testnet contract function with error handling for nonce
async function triggerTestnetFunction(testnetContract, nonce) {
  try {
    const txResponse = await testnetContract.jungle__Action_accelerate({
      value: 0, // Assuming the function requires value to be sent as payable
      nonce: nonce // Use the correct nonce
    });
    const receipt = await txResponse.wait();
    console.log(`Testnet transaction triggered: ${receipt.transactionHash}`);
    return true;
  } catch (error) {
    console.error(`Error triggering function on testnet with nonce ${nonce}:`, error);
    return false;
  }
}

// Sleep function to prevent overloading
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to process a block
async function processBlock(blockNumber) {
  try {
    const block = await mainnetProvider.getBlockWithTransactions(blockNumber);
    console.log(`Analyzing block ${blockNumber}, ${block.transactions.length} transactions found.`);

    let mainnetTxCount = 0;
    let testnetTxCount = 0;
    let triggered = false;

    for (const tx of block.transactions) {
      // Check if the transaction is to the MAINNET_ADDRESS
      if (tx.to && tx.to.toLowerCase() === MAINNET_ADDRESS.toLowerCase()) {
        console.log(`Mainnet transaction detected: ${tx.hash}`);
        mainnetTxCount++;

        // Set up testnet contract instance
        const testnetContract = new ethers.Contract(TESTNET_CONTRACT_ADDRESS, testnetContractAbi, wallet);

        // Get the current nonce for the wallet
        const nonce = await testnetProvider.getTransactionCount(wallet.address, 'latest');

        // Try triggering the function with the current nonce, nonce+1, and nonce-1
        triggered = await triggerTestnetFunction(testnetContract, nonce);
        if (!triggered) triggered = await triggerTestnetFunction(testnetContract, nonce + 1);
        if (!triggered) triggered = await triggerTestnetFunction(testnetContract, nonce - 1);

        if (triggered) {
          testnetTxCount++;
          break; // Exit the loop after triggering a transaction
        }
      }
    }

    console.log(`Block ${blockNumber} processed. Mainnet transactions: ${mainnetTxCount}, Testnet transactions triggered: ${testnetTxCount}`);
    return triggered;
  } catch (error) {
    console.error(`Error processing block ${blockNumber}:`, error);
    return false;
  }
}

// Start processing blocks in parallel
async function start(X) {
  lastProcessedBlock = await mainnetProvider.getBlockNumber();
  console.log(`Starting from block ${lastProcessedBlock}`);

  const parallelBlocks = 5; // Number of blocks to process in parallel
  let lastJumpTime = Date.now();

  while (true) {
    const blockPromises = [];

    for (let i = 0; i < parallelBlocks; i++) {
      blockPromises.push(processBlock(lastProcessedBlock + i));
    }

    const results = await Promise.all(blockPromises);
    const transactionTriggered = results.includes(true);

    if (transactionTriggered || (Date.now() - lastJumpTime) >= X * 1000) {
      lastProcessedBlock = await mainnetProvider.getBlockNumber();
      console.log(`Jumping to the latest block ${lastProcessedBlock}`);
      lastJumpTime = Date.now();
    } else {
      lastProcessedBlock += parallelBlocks;
    }

    await sleep(400); // Sleep for 1 second before processing the next set of blocks
  }
}

// Start the script with X seconds parameter
const X = 5; // Change this value to the desired number of seconds
start(X).catch(console.error);
