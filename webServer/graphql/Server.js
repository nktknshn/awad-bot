const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const app = express();

const fs = require('fs');
const typeDefs = fs.readFileSync('./schema.graphql',{encoding:'utf-8'})
const resolvers = require('./resolvers')
const server = new ApolloServer({ typeDefs, resolvers });
server.applyMiddleware({ app });
var { graphqlHTTP } = require('express-graphql');




// gql endpoint
app.use('/graphql', gql({schema}))

// gql visual editor for queries
app.use('/graphiql',gql({endpointURL:'/graphql'}))