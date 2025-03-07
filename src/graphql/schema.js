// Import required stuff from graphql
const { GraphQLSchema, GraphQLObjectType } = require("graphql");

// Import queries
const {
  blocks,
  block,
  transactions,
  transaction,
  transactionsByAddress,
  transactionsByStatus
} = require("./queries");

// Define QueryType
const QueryType = new GraphQLObjectType({
  name: "QueryType",
  description: "Queries",
  fields: {
    blocks,
    block,
    transactions,
    transaction,
    transactionsByAddress,
    transactionsByStatus
  },
});

module.exports = new GraphQLSchema({
  query: QueryType
});
