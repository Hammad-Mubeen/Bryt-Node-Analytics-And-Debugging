const {
    GraphQLObjectType,
    GraphQLList
} = require("graphql");

const { ballotType } = require('./ballot');
const { blocksType } = require('./blocks');
const { transactionsType } = require('./transactions');

const blocksBallotedAndTransactionsType = new GraphQLObjectType({
  
    name: "blocksBallotedAndTransactions",
    description: "blocksBallotedAndTransactions type",
    fields: () => ({
        ballot: {type: ballotType},
        block: {type: blocksType},
        transactions: {type: GraphQLList(transactionsType)}
  })
});
  
module.exports = { blocksBallotedAndTransactionsType };

