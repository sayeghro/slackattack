// imports
import botkit from 'botkit';
import Yelp from 'yelp';

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});


// initialize yelp api
const yelp = new Yelp({
  consumer_key: process.env.YELP_CONSUMER_KEY,
  consumer_secret: process.env.YELP_CONSUMER_SECRET,
  token: process.env.YELP_TOKEN,
  token_secret: process.env.YELP_TOKEN_SECRET,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM(err => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

controller.hears(['food', 'hungry', 'restaurant'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  // start a conversation to handle this response.
  bot.startConversation(message, (err, convo) => {
    convo.ask('Would you like recommendations for food?', [
      {
        pattern: bot.utterances.yes,
        callback: () => {
          getQuery(convo);
          convo.next();
        },
      },
      {
        pattern: bot.utterances.no,
        callback: () => {
          convo.say('Ok. No food recommendations then... Sorry if I misunderstood you.');
          convo.next();
        },
      },
      {
        default: true,
        callback: () => {
          // Repeat the question since bot did not understand response.
          convo.say('Sorry, I don\'t know what you\'re trying to say. Please try again.');
          convo.repeat();
          convo.next();
        },
      },
    ]);
  });
  function getQuery(convo) {
    convo.ask('Ok, you are hungry. What type of food would you like to eat?', (foodType) => {
      getLocation(convo, foodType);
      convo.next();
    });
  }

  function getLocation(convo, foodType) {
    convo.ask('And where are you?', (loc) => {
      convo.say('Ok! Gimme a sec while I pull up the best results for you!');
      // Query the Yelp API
      yelp.search({ term: foodType.text, location: loc.text }).then((data) => {
        if (data.businesses.length !== 0) {
          const attachment = {
            text: `Rating: ${data.businesses[0].rating}`,
            attachments: [
              {
                title: `${data.businesses[0].name}`,
                title_link: `${data.businesses[0].url}`,
                text: `${data.businesses[0].snippet_text}`,
                image_url: `${data.businesses[0].image_url}`,
              },
            ],
          };
          convo.say(attachment);
        } else {
          console.log('made it to else');
          convo.say(`Hmmm, I couln\'t find and results for ${foodType.text} in ${loc.text}.`);
        }
          // convo.next();
      }).catch((err) => {
        convo.say(`Hmmm, I couln\'t find your location, ${loc.text}. Please try again.`);
        convo.repeat();
        convo.next();
        console.error(err);
      });
      convo.next();
    });
  }
});
