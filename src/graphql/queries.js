const {
  GraphQLString,
  GraphQLList
} = require("graphql");

// import types
const { nodesType } = require("./types/nodes");
const { blocksWithCountType } = require("./types/blocksWithCount");
const { blocksBallotedAndTransactionsType } = require("./types/blocksBallotedAndTransactions");

const DB = require("../db");

// import Models
var nodeModel= require("../db/models/node.model");
var BlockModel = require("../db/models/block.model");
var TransactionModel= require("../db/models/transaction.model");
var ballotedDataModel= require("../db/models/ballotedData.model");

const allNodes = {
  type: GraphQLList(nodesType),
  description: "View all nodes",
  async resolve(parent, args, context) {
    try {
      let nodesData = await DB(nodeModel.table);
      console.log("nodesData: ",nodesData);
      return nodesData[0].nodes;
    } catch (error) {
      throw new Error(error);
    }
  },
};

const blocks = {
  type: blocksWithCountType,
  description: "Latest blocks and view all blocks against rpc",
  args: {
    url: {type: GraphQLString},
    lastId: { type: GraphQLString },
    limit: { type: GraphQLString },
  },
  async resolve(parent, args, context) {
    try {

      // count total blocks
      let arr1 = await DB(BlockModel.table).count('* as total').where({rpcURL: args.url});
      let arr2 = await DB(BlockModel.table).count('* as total');
      let count1 = arr1[0].total.toString();
      let count2 = arr2[0].total.toString();

      let db_last_id = BigInt(count2 - args.lastId);

      //Keyset pagination for blocks data
      let blocks = await DB(BlockModel.table)
      .where({rpcURL: args.url})
      .where('id' ,'<=', db_last_id)
      .orderBy('id','desc')
      .limit(parseFloat(args.limit));

      return {blocks: blocks, count: count1};
    } catch (error) {
      throw new Error(error);
    }
  },
};

const getBlocksBallotedAndTransactions = {
  type: blocksBallotedAndTransactionsType,
  description: "Latest blocks and view all blocks",
  args: {
    url: { type: GraphQLString },
    blockNumber: { type: GraphQLString },
  },
  async resolve(parent, args, context) {
    try {

      let ballot = await DB(ballotedDataModel.table)
      .where({rpcURL: args.url})
      .where({block_number: args.blockNumber});

      let block = await DB(BlockModel.table)
      .where({rpcURL: args.url})
      .where({block_number: args.blockNumber});

      let transactionsData=[];

      if(block[0].transactions == null)
      {
        transactionsData = null;
      }
      else{
        for (var i =0; i < block[0].transactions.length; i++)
        {
          let transaction = await DB(TransactionModel.table)
          .where({rpcURL: args.url})
          .where({block: args.blockNumber})
          .where({hash: block[0].transactions[i]});

          transactionsData.push(transaction[0]);
        }
      }
      
      return { ballot: ballot[0], block: block[0], transactions: transactionsData };
    } catch (error) {
      throw new Error(error);
    }
  },
};

module.exports = {
  allNodes,
  blocks,
  getBlocksBallotedAndTransactions
};
