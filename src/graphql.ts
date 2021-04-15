import "reflect-metadata";
import { createConnection } from "typeorm";
import { ApolloServer } from "apollo-server";
import { buildSchema, Query, Resolver, Arg } from "type-graphql";
import { WordEntity } from "./database/entity/word";


@Resolver()
export class WordResolver {
    @Query(() => [WordEntity])
    words() {
        return WordEntity.find()
    }
}

async function main() {
    const connection = await createConnection()
    
    const schema = await buildSchema({
        resolvers: [WordResolver]
    })

    const server = new ApolloServer({ schema })
    await server.listen(4000)
    mylog("Server has started!")
}

main()