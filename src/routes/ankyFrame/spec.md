# Save reply triade

The mission for this system is to deploy a cast action that allows allowlisted users to add cast triades to the database, which then will be used to train "Llama 3 ::: Anky", which is a fine tuned LLM that powers the farcaster bot @anky.eth.

The process of the user is the following:

1. Find a root cast that is a good representation of what is happening on farcaster.

2. Search within the replies to that cast an example of a "bad" reply to it (obvious low effort or a generic AI reply).

3. Copy the cast's link on warpcast, or the cast hash.

4. Find a cast that can be labelled as a "good reply", and call the "save this reply" cast action on that one.

5. The frame that is shown to the user should have a text input where the user needs to paste the link or hash of the bad reply.

6. After the user sends this, the backend should store this cast triade as training data for the LLM. 

7. The user should see how many casts have been saved that day, and the aim should be towards 100. That's the number of casts that we need daily to fine tune the model.