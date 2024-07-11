import OpenAI from "openai";
import { OPENAI_API_KEY } from "../env/server-env";

import { sleep } from "./time";

const openai = new OpenAI({
    organization: "org-jky0txWAU8ZrAAF5d14VR12J",
    apiKey: OPENAI_API_KEY,
  });

type CompletionFormat = "text" | "json";

export async function sendBasicCompletionToOllama(
    systemPrompt: string,
    assistantPrompt: string,
    text: string,
    format: CompletionFormat | null | undefined
  ) {
    const llmModelUsed = "llama3"
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "assistant",
        content: assistantPrompt,
      },
      {
        role: "user",
        content: text,
      },
    ]
    try {
      // trying with the local llm first
      const response = await axios.post("http://localhost:11434/api/chat", {
        model: llmModelUsed,
        messages: messages,
        stream: false,
        format: format,
      });
      const responseFromLocalLLM = response.data.message.content;
      return responseFromLocalLLM;
    } catch (error) {
      console.log("there was an error fetching the local LLM, time to try chatgtp", error)
      try {
        await sendBasicChatCompletionToChatGTP(messages)
      } catch (error) {
        console.log("both the calls to chatgtp and openai failed")
        await sleep(60000)
        sendBasicCompletionToOllama(systemPrompt, assistantPrompt, text, format)
      }
    }
  }

export async function callChatGTPToGetReply(systemPrompt: string, castText: string) {
    try {
      console.log("calling chatgtp to get the reply to this cast");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: castText,
          },
        ],
      });
      console.log("the response from the completicsaOoooon", completion);
      const dataResponse = completion.choices[0].message.content;
      return dataResponse;
    } catch (error) {
      console.log("there was an error calling the chatgtp api");
      return "";
    }
  }
  
  export async function sendBasicChatCompletionToChatGTP(messages: ChatCompletionMessageParam[]){
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages
      });
      const chatgtpResponse = completion.choices[0].message.content;
      return chatgtpResponse;
    } catch (error) {
      throw new Error("there was an error getting the chat completion from chatgtp")
    }
  }

  export async function callChatGTPToGetSadhanaInterpretation(systemPrompt: string, castText: string) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { "type": "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: castText,
          },
        ],
      });
      const dataResponse = completion.choices[0].message.content;
      return dataResponse;
    } catch (error) {
      console.log("there was an error calling the chatgtp api");
      return "";
    }
  }