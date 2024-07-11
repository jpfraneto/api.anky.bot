import { callChatGTPToGetSadhanaInterpretation } from "../../../utils/ai";
import prisma from "../../../utils/prismaClient";
import { ANKY_SIGNER, NEYNAR_API_KEY } from "../../../env/server-env";
import { Cast } from "../../../utils/types/cast";
import { publishCastToTheProtocol } from "../../../utils/cast";

export async function getAnkysInterpretation (userReplies: Cast[]){
    try {
        for (let reply of userReplies) {
            const sadhanaInDatabase = await prisma.sadhana.findUnique({
                where: {
                    sadhanaCastHash: reply.hash
                }
            })
            if(sadhanaInDatabase) {
                console.log("this sadhana is already on the database", reply.hash)
                continue
            } else {
                const systemPrompt = `you are going to receive the a reply that a user made in a post in a social media network called farcaster, which has the mission to be the commitment that this user is doing to do a certain activity for a given amount of days, and they are betting against their ability to do it. your mission is to interpret if this is a valid commitment, and for that you need to understand what is being said. reply with a json object with the following properties:
                 {
                    isValidCommmitment: your interpretation of the validity of the commitment,
                    betInDegen: the user should use the formatting "X $degen" in order to bet. if this format is not present, the commitment is not valid,
                    description: if the commitment is valid, summarize it here so that what the user has to do is as clear as possible,
                    amountOfDays: the amount of days that the user committed to do what they said they would do. if not clear, the commitment is not valid.
                 }
                `
                const userPrompt = reply.text
                const interpretationOfSadhana = await callChatGTPToGetSadhanaInterpretation(systemPrompt, userPrompt) 
                console.log("the interpretation of the sadhana is", interpretationOfSadhana)
                const commitmentResponse = JSON.parse(interpretationOfSadhana!)
                if(commitmentResponse?.isValidCommitment){
                    const responseFromPrisma = await prisma.sadhana.create({
                        data: {
                            parentCastHash: reply.parent_hash,
                            sadhanaCastHash: reply.hash,
                            userId: reply.author.fid,
                            durationInDays: commitmentResponse.amountOfDays,
                            betInDegen: commitmentResponse.betInDegen,
                            description: commitmentResponse.description
                        }
                    })
                    let castOptions = {
                        text: "",
                        embeds: [{url: `https://api.anky.bot/sadhana/created-sadhana/${responseFromPrisma.id}`}],
                        parent: reply.hash,
                        signer_uuid: ANKY_SIGNER,
                    };
                    const castResponse = await publishCastToTheProtocol(castOptions, NEYNAR_API_KEY)
                    console.log("the cast response is: ", castResponse)
                    const updatePrismaObject = await prisma.sadhana.update({
                        where: {
                            id: responseFromPrisma.id
                        }, data: {
                            replyToAcknowledgeSadhanaHash: castResponse.hash
                        }
                    })
                    console.log("the user was acknowledged that the sadhana started")
                    // model Sadhana {
                    //     id                     String            @id @default(uuid())
                    //     parentCastHash         String
                    //     sadhanaCastHash        String            @unique
                    //     userId                 Int?
                    //     User                   User?             @relation(fields: [userId], references: [id])
                    //     createdAt              DateTime          @default(now())
                    //     durationInDays         Int
                    //     betInDegen             Int
                    //     sessionsAccomplished   SadhanaSessions[]
                    //     success                Boolean           @default(false)
                    //     description            String
                    //     replyToAcknowledgeSadhanaHash  String?
                    //     userAccepted           Boolean       @default(false)
                    //   }
                } else {

                }
                return interpretationOfSadhana
            }
        }
    } catch (error) {
        console.log("there was an error interpreting the sadhana")
    }
}