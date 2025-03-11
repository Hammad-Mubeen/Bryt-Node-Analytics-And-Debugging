//for all env variables imports
require("dotenv").config();
var express = require('express');
var router = express.Router();
const DB = require("../db");
const BlockchainClient = require("bryt-sdk");
const WebSocket = require('ws');
var BlockModel = require("../db/models/block.model");
var TransactionModel= require("../db/models/transaction.model");
var AlertModel= require("../db/models/alert.model");
var ballotedTransactionsQueueModel= require("../db/models/ballotedTransactionsQueue.model");
var ballotedDataModel= require("../db/models/ballotedData.model");
var blocksQueueModel= require("../db/models/blocksQueue.model");

console.log("=========== Connecting with RPCs ===========\n");

let rpcs = [], current_rpc = null, wait_to_be_mined = null, total_no_of_retries = null,
lastMinorityBlock = null, latestMajorityBlock = null, minority= null, majority = null;

let JSON_RPC_NODE_URLs = [
'http://' + process.env.NODE_URL +':8010/rpc',
'http://' + process.env.NODE_URL +':8020/rpc',
'http://' + process.env.NODE_URL +':8030/rpc',
'http://' + process.env.NODE_URL +':8040/rpc',
'http://' + process.env.NODE_URL +':8050/rpc',
];

let RPC_SOCKET_URLs = [
'ws://' + process.env.NODE_URL +':8010/ws/v2',
'ws://' + process.env.NODE_URL +':8020/ws/v2',
'ws://' + process.env.NODE_URL +':8030/ws/v2',
'ws://' + process.env.NODE_URL +':8040/ws/v2',
'ws://' + process.env.NODE_URL +':8050/ws/v2',
] 

async function makeRPCSClients()
{
  for (var i=0; i < JSON_RPC_NODE_URLs.length; i++)
  {
    rpcs[i] = new BlockchainClient(JSON_RPC_NODE_URLs[i],process.env.PRIVATE_KEY);
  }
  current_rpc = rpcs[0];
}

async function setWaitToBeMinedAndRetries(blockNumber)
{
  let height = BigInt(await fetchLatestBlockHeightHelper());
  let start = height - BigInt(5);
  if (blockNumber >= start && blockNumber <= height)
  {
    console.log("BlockClient is between 5 blocks less than latest block range...");
    wait_to_be_mined = process.env.WAIT_TO_BE_MINED,
    total_no_of_retries = process.env.TOTAL_NO_OF_RETRIES;
  }
  else{
    console.log("BlockClient is 5 blocks behind the latest block...");
    wait_to_be_mined=0; 
    total_no_of_retries=0;
  }
}

async function findMaxDuplicateElement(arr) {
  const frequency = {};

  // Count the frequency of each element
  arr.forEach(element => {
      frequency[element] = (frequency[element] || 0) + 1;
  });

  // Find the element with the maximum frequency
  let maxCount = 0;
  let maxElement = null;
  let array = [];
  for (const [element, count] of Object.entries(frequency)) {
      if (count > maxCount) {
          maxCount = count;
          maxElement = element;
      }
      let obj = {"element" : element, "count" : count};
      array.push(obj);
  }

  return { array: array, element: maxElement, count: maxCount };
}

async function saveFaultyBlockInDb(blockNumber,block_status)
{
  await DB(AlertModel.table)
  .insert({
    block_number: blockNumber.toString(),
    block_status: block_status
  })
  .returning("*");
}

async function changeFaultyBlockStatusInDb(blockNumber,block_status)
{
  await DB(AlertModel.table)
  .where({ block_hash: blockNumber.toString()})
  .update({
    block_status: block_status
  })
  .returning("*");
}


const sleep = (num) => {
  return new Promise((resolve) => setTimeout(resolve, num));
};

// to get the latest block height
async function getLatestBlockHeight(retry) {
  try {
    let flag = 0;
    let latestBlockInfoResult = null;
    current_rpc.getBlockHeight()
      .then(function (blockData) {
        if(blockData.result)
        {
          latestBlockInfoResult = blockData.result.height;
          flag = 1;
        }
        else if (blockData.error)
        {
          console.log("RPC failed: in fecthing latest block Height.");
          console.log("error is : ", blockData.error.message);
          retry.rpcFailed = true;
        }
      })
      .catch(function (error) {
        console.log("RPC failed: in fecthing latest block Height.");
        console.log("error is : ", error);
        retry.rpcFailed = true;
      });

    while (
      flag == 0 &&
      retry.rpcFailed == false
    ) {
      console.log("Checking for RPC response Type...");
      await sleep(500);
    }

    if (flag == 1) {
      return latestBlockInfoResult;
    } else if (retry.rpcFailed == true) {
      await sleep(wait_to_be_mined);
      return false;
    }
  } catch (error) {
    console.log("error is : ", error);
  }
}

// This function is to retry latest block height upon RPC Failures
async function fetchLatestBlockHeightHelper() {
  try {
    let retry = {
      rpcFailed: false,
    };
    let blockResult = await getLatestBlockHeight(retry);

    if (blockResult == false) {
      if (retry.rpcFailed == true) {
        while (blockResult == false) {
          retry.rpcFailed = false;
          console.log("Retrying the RPC Call for latest block height...");
          blockResult = await getLatestBlockHeight(retry);
        }
        console.log(
          "Retrying Attempts to fetch latest block height is Successfull..."
        );
        return blockResult;
      }
    } else {
      return blockResult;
    }
  } catch (error) {
    console.log("Error : ", error);
  }
}

// to get block data against block height
async function getBlockData(height, retry, current_rpc) {
  try {
      console.log("Fetching block : \n", height);
      
      let flag = 0;
      let blockResponse = null;
      current_rpc.getBlockByBLockNumber(height)
        .then(function (blockData) {
          if(blockData.result)
          {
            blockResponse = blockData;
            flag = 1;
          }
          else if (blockData.error)
          {
            console.log("RPC failed: in fecthing blockData " + height);
            console.log("error is : ", blockData.error.message);
            retry.rpcFailed = true;
          }
        })
        .catch(function (error) {
          console.log("RPC failed: in fecthing blockData " + height);
          console.log("error is : ", error);
          retry.rpcFailed = true;
        });
        
      while (
        flag == 0 &&
        retry.rpcFailed == false
      ) {
        console.log("Checking for RPC response Type...");
        await sleep(500);
      }

      if (flag == 1) {
        return blockResponse;
      } else if (retry.rpcFailed == true) {
        await sleep(wait_to_be_mined);
        return false;
      }
  } catch (error) {
    console.log("error : ", error);
  }
}

// This function is to retry blockData upon RPC Failures
async function fetchBlockDataHelper(blockNumber,current_rpc) {
  try {
    let retry = {
      rpcFailed: false,
    };
    let blockResult = await getBlockData(blockNumber, retry, current_rpc);
    
    if (blockResult == false) {
      if (retry.rpcFailed == true) {
        let totalRetries = total_no_of_retries;
        while (blockResult == false) {
          console.log("totalRetries: ",totalRetries);
          if(totalRetries == 0)
          {
            return false;
          }
          retry.rpcFailed = false;
          console.log("Retrying the RPC Call for block: ", blockNumber);
          blockResult = await getBlockData(blockNumber, retry, current_rpc);
          totalRetries = totalRetries - 1;
        }
        console.log(
          "Retrying Attempts to fetch blockData is Successfull : ",
          blockNumber
        );
        return blockResult;
      }
    } else {
      return blockResult;
    }
  } catch (error) {
    console.log("Error : ", error);
  }
}

// to get transaction data against hash
async function getTransactionData(hash, retry) {
  try {
      console.log("Fetching transaction: \n", hash);
      
      let flag = 0;
      let transactionResponse = null;
      current_rpc.getTransactionByHash(hash)
        .then(function (transactionData) {
          if(transactionData.result)
          {
            transactionResponse = transactionData;
            flag = 1;
          }
          else if (transactionData.error)
          {
            console.log("RPC failed: in fecthing transactionData " + hash);
            console.log("error is : ", transactionData.error.message);
            retry.rpcFailed = true;
          }
        })
        .catch(function (error) {
          console.log("RPC failed: in fecthing transactionData " + hash);
          console.log("error is : ", error);
          retry.rpcFailed = true;
        });
        
      while (
        flag == 0 &&
        retry.rpcFailed == false
      ) {
        console.log("Checking for RPC response Type...");
        await sleep(500);
      }

      if (flag == 1) {
        return transactionResponse;
      } else if (retry.rpcFailed == true) {
        await sleep(wait_to_be_mined);
        return false;
      }
  } catch (error) {
    console.log("error : ", error);
  }
}

// This function is to retry transactionData upon RPC Failures
async function fetchTransactionDataByHashHelper(hash) {
  try {
    let retry = {
      rpcFailed: false,
    };
    let transactionResult = await getTransactionData(hash, retry);
    
    if (transactionResult == false) {
      if (retry.rpcFailed == true) {
        let  i = 0;
        while (transactionResult == false) {
          current_rpc = rpcs[i]
          retry.rpcFailed = false;
          console.log("Retrying the RPC Call for transaction: ", hash);
          transactionResult = await getTransactionData(hash, retry);
          i = i + 1;
        }
        console.log(
          "Retrying Attempts to fetch transactionData is Successfull : ",
          hash
        );
        return transactionResult;
      }
    } else {
      return transactionResult;
    }
  } catch (error) {
    console.log("Error : ", error);
  }
}

async function syncData()
{
  if(minority == null || majority == null || minority == false || majority == false)
  {
    console.log("No need to sync the data.");
  }
  else{
    // start syncing data
    minority = false;
    let last_minority_block = lastMinorityBlock, latest_majority_block = latestMajorityBlock;
    let  alertData = await DB(AlertModel.table);
    for (var i =0; i < alertData.length; i++ )
    {
      let alertBlockNumber = BigInt(alertData[i].block_number);
      console.log("syncing block Number: ",alertBlockNumber);
      if(alertBlockNumber >= last_minority_block && alertBlockNumber < latest_majority_block)
      {
        let sync_results=[], sync_results_with_all_data=[];
        for (var j = 0; j < rpcs.length; j++)
        {
          console.log("RPC: ",JSON_RPC_NODE_URLs[j]);
          let result = await fetchBlockDataHelper(alertBlockNumber.toString(),rpcs[j]);
          if(result == false)
          {
            console.log("Either port is stuck or down: ", JSON_RPC_NODE_URLs[j]);
            sync_results_with_all_data=[];
            break;
          }
          sync_results[j] = result.result.block_hash;
          sync_results_with_all_data[j] = result;
          console.log("block data: ",result);
        }
        if(sync_results_with_all_data.length !=0)
        {
          const maxDuplicateElement = await findMaxDuplicateElement(sync_results);
          // if data is correct
          if(maxDuplicateElement.count > 1)
          {
            console.log("correct block data found in syncing: ",alertBlockNumber);
            let index = sync_results.indexOf(maxDuplicateElement.element);
            await DB(BlockModel.table)
            .where({ block_number: alertBlockNumber.toString() })
            .update({
              version: sync_results_with_all_data[index].result.version.toString(),
              merkle_root: sync_results_with_all_data[index].result.version,
              block_status: "Finalized",
              previous_hash: sync_results_with_all_data[index].result.previous_hash,
              state_root: sync_results_with_all_data[index].result.state_root,
              transaction_root : sync_results_with_all_data[index].result.transaction_root,
              reciept_root: sync_results_with_all_data[index].result.reciept_root,
              //timestamp: sync_results_with_all_data[index].result.timestamp.toString(),
              logs_bloom: sync_results_with_all_data[index].result.logs_bloom,
              transactions: sync_results_with_all_data[index].result.transactions,
              block_reward: sync_results_with_all_data[index].result.block_reward,
              value: sync_results_with_all_data[index].result.value,
              data: sync_results_with_all_data[index].result.data,
              to: sync_results_with_all_data[index].result.to,
              block_hash: sync_results_with_all_data[index].result.block_hash
            })
            .returning("*");
            if(sync_results_with_all_data[index].result.transactions != null)
            {
              for (var k =0; k < sync_results_with_all_data[index].result.transactions.length; k++ )
              {
                await DB(TransactionModel.table)
                .where({ hash: sync_results_with_all_data[index].result.transactions[k]})
                .update({
                  block : alertBlockNumber.toString(),
                })
                .returning("*");
              }
            }
            console.log("changing block status in alert table.");
            await changeFaultyBlockStatusInDb(alertBlockNumber,"Finalized");
          }
          else{
            console.log("Majority data not found in syncing for block number: ",alertBlockNumber);
          }
        }
      }
      if(alertBlockNumber == latestMajorityBlock)
      {
        let block = await DB(BlockModel.table).where({ block_number: alertBlockNumber.toString() });
        if(block.result.transactions != null)
        {
          for (var j =0; j < block.result.transactions.length; j++ )
          {
            await DB(TransactionModel.table)
            .where({ hash: block.result.transactions[j]})
            .update({
              block : alertBlockNumber.toString(),
            })
            .returning("*");
          }
        }
      }
    }
  }
}

// This function is to check block status
async function getBlockDataStatus(blockNumber) {
  try {
    let results=[], results_without_false=[], allPortsData=[], block_status;
    //read all RPCS for blocks
    for (var i = 0; i < rpcs.length; i++)
    {
      console.log("RPC: ",JSON_RPC_NODE_URLs[i]);
      let portsData = {rpcURL: JSON_RPC_NODE_URLs[i], block_hash: null, block_status: null};
      let result = await fetchBlockDataHelper(blockNumber.toString(),rpcs[i]);
      if(result == false)
      {
        results[i]= result;
      }
      else{
        results[i]=result.result.block_hash;
        portsData.block_hash= result.result.block_hash;
        portsData.block_status = "Minority";
      }
      console.log("block data: ",result);
      allPortsData.push(portsData);
    }

    let result = !results.some(e => e);
    if (result == true)
    {
      block_status= "Not Found";
      console.log("block data not found on any RPC: ",blockNumber);
      await saveFaultyBlockInDb(blockNumber,block_status);
      console.log("Saved faulty block in db.");
      return {allPortsData: allPortsData, block_status: block_status};
    }
    else
    {
      // if only 1 port have a block data
      results_without_false= results.filter(element => element !== false);
      if(results_without_false.length == 1)
      {
        console.log("Only 1 port have block data, block data is correct for blocknumber: ",blockNumber);
        index = results.indexOf(results_without_false[0]);
        allPortsData[index].block_status = "Majority";
        block_status="Finalized";
        return {allPortsData: allPortsData, block_status: block_status};
      }
      else{
        //check highest block hash occurance
        const maxDuplicateElement = await findMaxDuplicateElement(results_without_false);
        let count=0;
        for (var i = 0; i < maxDuplicateElement.array.length; i++)
        {
          if(maxDuplicateElement.count == maxDuplicateElement.array[i].count)
          {
            count++;
          }
        }
        //if data is not correct
        if(maxDuplicateElement.count == 1 || count > 1)
        {  
          block_status="Mined";
          console.log("block data is not correct, either all different block hashes on ports OR no highest occurance of one block hash: ",blockNumber);
          await saveFaultyBlockInDb(blockNumber,block_status);
          console.log("Saved faulty block in db.");
          // minority = true;
          // if(majority == true || majority == null)
          // {
          //   lastMinorityBlock = blockNumber;
          // }
          // majority = false;
          return {allPortsData: allPortsData, block_status: block_status};
        }
        else{
          block_status="Finalized";
          console.log("block data is correct, either all block hashes are same on ports OR a highest occurance of one block hash: ",blockNumber);
          // majority = true;
          // latestMajorityBlock = blockNumber;
          //syncData();
          for (var i=0; i<allPortsData.length; i++)
          {
            if(allPortsData[i].block_hash == maxDuplicateElement.element)
            {
              allPortsData[i].block_status = "Majority";
            }
          }
          return {allPortsData: allPortsData, block_status: block_status};
        }
      }
    }
  } catch (error) {
    console.log("Error : ", error);
  }
}
async function listenToRPCSockets(RPCSocketURL,rpcURL)
{
  // start listening
  // Create a WebSocket connection
  const socket = new WebSocket(RPCSocketURL);

  // Connection opened event
  socket.addEventListener('open', () => {
      console.log('Connected to RPC WebSocket: ',RPCSocketURL);
  });

  // Message event: handle messages from the server
  socket.addEventListener('message', async (event) => {
      const timestamp = Date.now();
      const parsedMessage = JSON.parse(event.data);
      if(parsedMessage.type == "transaction_ballot")
      {
        console.log('Message from RPC WebSocket: ', RPCSocketURL);
        console.log("transaction_ballot: ",parsedMessage.data);

        //enqueue data
        await DB(ballotedTransactionsQueueModel.table)
        .insert({
          rpcURL: rpcURL,
          hash: parsedMessage.data.hashesHex,
          Status:"process",
          block_number: (parsedMessage.data.epochCycle).toString(),
          timestamp: timestamp,
          data: JSON.stringify({blockNumber: parsedMessage.data.epochCycle,
              ballotHashes: parsedMessage.data.hashes})
        });
      }
      else if(parsedMessage.type == "finalized_block")
      {
        console.log('Message from RPC WebSocket: ', RPCSocketURL);
        console.log("finalized_block: ",parsedMessage.data);

        //enqueue data
        await DB(blocksQueueModel.table)
        .insert({
          rpcURL: rpcURL,
          hash: parsedMessage.data.block_hash,
          Status:"process",
          timestamp: timestamp,
          data: JSON.stringify(parsedMessage.data)
        });
      }
  });

  // Handle errors
  socket.addEventListener('error', (error) => {
      console.log('RPC WebSocket error: ',RPCSocketURL, ' :',error);
  });

  // Close event: handle when the connection is closed
  socket.addEventListener('close', () => {
      console.log('WebSocket connection closed: ', RPCSocketURL);
      // Attempt to reconnect after a delay when the connection is closed
      console.log("Attempt to reconnect after a delay when the connection is closed...");
      setTimeout(() =>listenToRPCSockets(RPCSocketURL,rpcURL), 5000); // Reconnect after 5 seconds
  });
}
async function listener()
{
  try
  {
    await makeRPCSClients();
    //listen for unconfirmed transactions and balloted block
    for (var i = 0; i < RPC_SOCKET_URLs.length; i++)
    {
      await listenToRPCSockets(RPC_SOCKET_URLs[i],JSON_RPC_NODE_URLs[i]);
    }
  } catch (error) {
    console.log("Error : ", error);
  }
}

async function processBallotedQueue()
{
  try
  {
    while(true)
    {
      let ballotedTransactionsQueue = await DB(ballotedTransactionsQueueModel.table)
      .where({Status:"process"})
      .orderBy('timestamp','asc')
      .limit(1);

      if(ballotedTransactionsQueue[0] != undefined)
      {
        let ballotedData = await DB(ballotedDataModel.table)
        .where({ rpcURL : ballotedTransactionsQueue[0].rpcURL,
          block_number : ballotedTransactionsQueue[0].block_number,
          hash: ballotedTransactionsQueue[0].hash,
        });

        if(ballotedData[0] !=undefined)
        {
          console.log("ballot data repeated on same rpcURL, block_number and hash.");
        }
        else{
          await DB(ballotedDataModel.table)
          .insert({ rpcURL : ballotedTransactionsQueue[0].rpcURL,
            block_number : ballotedTransactionsQueue[0].block_number,
            hash: ballotedTransactionsQueue[0].hash,
            timestamp: ballotedTransactionsQueue[0].timestamp,
            data: ballotedTransactionsQueue[0].data
          });
        }
        
        await DB(ballotedTransactionsQueueModel.table)
        .where({ id: ballotedTransactionsQueue[0].id})
        .update({Status : "completed"});

      }
      else{
        console.log("No balloted transactions are coming...");
        await sleep(2000);
      }
    }
  } catch (error) {
    console.log("Error : ", error);
  }
}

async function processBlocksQueue()
{
  try
  {
    while(true)
    {
      let blocksQueue = await DB(blocksQueueModel.table)
      .where({Status:"process"})
      .orderBy('timestamp','asc')
      .limit(1);

      if(blocksQueue[0] != undefined)
      {
        let blockData = JSON.parse(blocksQueue[0].data);

        let blocks = await DB(BlockModel.table)
        .where({ rpcURL: blocksQueue[0].rpcURL,
           block_number : (blockData.block_number).toString(),
           block_hash: blockData.block_hash 
        });
        
        if(blocks[0] != undefined)
        {
          console.log("block data repeated on same rpcURL, block_number and hash.");
        }
        else{

          let arr = await DB(BlockModel.table).count('* as total');
          let count = BigInt(arr[0].total.toString());

          await DB(BlockModel.table)
          .insert({
            id: count + BigInt(1),
            rpcURL: blocksQueue[0].rpcURL,
            version: blockData.version.toString(),
            merkle_root: blockData.version,
            block_number: blockData.block_number,
            previous_hash: blockData.previous_hash,
            state_root: blockData.state_root,
            transaction_root : blockData.transaction_root,
            reciept_root: blockData.reciept_root,
            logs_bloom: blockData.logs_bloom,
            transactions: blockData.transactions,
            block_reward: blockData.block_reward,
            value: blockData.value,
            data: blockData.data,
            to: blockData.to,
            block_hash: blockData.block_hash
          })
          .returning("*");

          if(blockData.transactions != null)
          {
            for (var i =0; i < blockData.transactions.length; i++ )
            {
              let transaction = await DB(TransactionModel.table)
              .where({ 
                rpcURL: blocksQueue[0].rpcURL,
                block: blockData.block_number,
                hash :  blockData.transactions[i]
              });

              if(transaction.length == 0)
              {
                const transactionData = await fetchTransactionDataByHashHelper(blockData.transactions[i]);
                console.log("transactionData: ",transactionData);
                
                let arr = await DB(TransactionModel.table).count('* as total');
                let count = BigInt(arr[0].total.toString());
  
                await DB(TransactionModel.table)
                .insert({
                  id: count + BigInt (1),
                  rpcURL: blocksQueue[0].rpcURL,
                  transaction_Status: "Confirmed",
                  hash: transactionData.result.transaction.TransferObj.hash,
                  block : (blockData.block_number).toString(),
                  from: transactionData.result.transaction.TransferObj.from,
                  to: transactionData.result.transaction.TransferObj.to,
                  value: transactionData.result.transaction.TransferObj.value.toString(),
                  transaction_status: transactionData.result.transaction.transaction_status,
                  functionType: transactionData.result.transaction.type,
                  Status: transactionData.result.transaction.Status,
                  State: transactionData.result.transaction.State,
                  nonce: transactionData.result.transaction.TransferObj.nonce.toString(),
                  type: transactionData.result.transaction.TransferObj.type.toString(),
                  node_id: transactionData.result.transaction.TransferObj.node_id,
                  gas: transactionData.result.transaction.TransferObj.gas.toString(),
                  gas_price: transactionData.result.transaction.TransferObj.gas_price.toString(),
                  input: transactionData.result.transaction.TransferObj.input,
                  unix_timestamp:Date.now()
                })
                .returning("*");
              }
              else{
                console.log("transaction data repeated on same rpcURL, block_number and hash.");
              }
            }
          }
        }
        await DB(blocksQueueModel.table)
        .where({id: blocksQueue[0].id})
        .update({Status : "completed"})
        .returning("*"); 
      }
      else{
        console.log("No new blocks are coming...");
        await sleep(2000);
      }
    }
  } catch (error) {
    console.log("Error : ", error);
  }
}

async function checkBlockDataMajorityAndMinority()
{
  try{
    console.log("block Data mined(minority and majority) checking started...");
    blockNumber=BigInt(1);
    while (true)
    {
      await setWaitToBeMinedAndRetries(blockNumber);
      let {allPortsData,block_status} = await getBlockDataStatus(blockNumber);
      if (block_status == "Not Found")
      {
        console.log("Block Data not found on any port: ",blockNumber);
      }
      else
      {
        for (var i=0; i< allPortsData.length;i++)
        {
          if(allPortsData[i].block_hash != null)
          {
            console.log("allPortsData[i].rpcURL: ",allPortsData[i].rpcURL);
            console.log("blockNumber: ",blockNumber);
            console.log("allPortsData[i].block_hash: ",allPortsData[i].block_hash);
            console.log("block_status: ",block_status);
            console.log("allPortsData[i].block_status: ",allPortsData[i].block_status);
            await DB(BlockModel.table)
            .where({rpcURL: allPortsData[i].rpcURL,
              block_number : (blockNumber).toString(),
              block_hash: allPortsData[i].block_hash
            })
            .update({
              block_status: block_status,
              Status: allPortsData[i].block_status
            });
          }
          else{
            console.log("Block Data not found on port: " +allPortsData[i].rpcURL + " blockNumber: " + blockNumber + " blockHash: " + allPortsData[i].block_hash);
          }
        }
      }
      blockNumber = blockNumber + BigInt(1);
    }
  }catch(error){
    console.log("error : ", error);
  }
}

listener();
processBallotedQueue();
processBlocksQueue();
checkBlockDataMajorityAndMinority();

module.exports = router;    