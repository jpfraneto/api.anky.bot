<!-- PROJECT LOGO -->

<p align="center">
  <a href="https://github.com/anky-bot/api.anky.bot">
   <img src="https://github.com/jpfraneto/images/blob/main/anky_logo.png?raw=true" alt="Logo">
  </a>

  <h3 align="center">Anky</h3>

  <p align="center">
    Tell us who you are.
    <br />
    <a href="https://cal.com"><strong>Write on Anky</strong></a>
    <br />
    <br />
    <a href="https://www.warpcast.com/anky.eth">Talk to Anky</a>
    ·
    <a href="https://wiki.anky.lat">Lore</a>
    ·
    <a href="https://">Issues</a>
  </p>
</p>

---

This is the backend of Anky. The most "social" expression of this system is the farcaster bot @anky.eth, which is an LLM that is fine tuned every day with two techniques:

### Supervised Fine Tuning (SFT)

The intention of this part of the training is to allow Anky to think as a human. As data, we use the streams of consciousness that people write through our app, which is located here: https://www.anky.bot.

The code for that web-app is (here)[https://github.com/jpfraneto/anky.bot], and it is also open source. That app talks to this server.

We have plans for making this a mobile app also.

### Direct Preference Optimization (DPO)

This training teaches Anky which replies are successful and which ones aren't. The basis of this is a cast triada, on which we have a root cast with two replies. An example of a good one, and also an example of a bad one.

By training the model with this data, it learns which is the way to reply that makes the most sense.

---


