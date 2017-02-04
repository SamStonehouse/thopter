const request = require('request-promise-native');
const Url = require('urijs');

const abilityWords = require('./middleware/ability-words');
const footer = require('./middleware/footer');
const manamoji = require('./middleware/manamoji');
const reminderText = require('./middleware/reminder-text');

const COLOR = '#431E3F';


class TextResponse {
  constructor(cardName) {
    this.cardName = cardName;
  }

  makeQuerystring() {
    return {
      fuzzy: this.cardName,
      format: 'text'
    }
  }

  makeUrl() {
    return Url(this.url).query(this.makeQuerystring()).toString();
  }

  makeRequest() {
    return new Promise((resolve, reject) => {
      request({
        method: 'GET',
        resolveWithFullResponse: true,
        uri: this.makeUrl()
      }).then(response => {
        resolve(response);
      }).catch(err => {
        resolve(err.response);
      });
    });
  }

  makeAttachment(response) {
    let parts = response.body.split('\n');
    const attachmentTitle = parts.shift();
    return {
      text: parts.join('\n'),
      title: attachmentTitle,
      title_link: response.headers['x-scryfall-card'],
      color: COLOR
    };
  }

  attachment() {
    return new Promise((resolve, reject) => {
      this.makeRequest().then(response => {
        let attachment = this.makeAttachment(response);
        this.middleware.length > 0 && this.middleware.forEach(mw => {
          attachment = mw(attachment);
        });
        resolve(attachment);
      });
    });
  }
}

TextResponse.prototype.middleware = [
  footer,
  manamoji,
  reminderText,
  abilityWords
];
TextResponse.prototype.url = 'https://api.scryfall.com/cards/named';


class ImageResponse extends TextResponse {
  makeAttachment(response) {
    let parts = response.body.split('\n');
    return {
      image_url: response.headers['x-scryfall-card-image'],
      title: parts[0].match(/^([^{]+)/)[0].trim(),
      title_link: response.headers['x-scryfall-card'],
      color: COLOR
    };
  }
}

ImageResponse.prototype.middleware = [footer, manamoji];


class PriceResponse extends TextResponse {
  makeAttachment(response) {
    let parts = response.body.split('\n');
    const u = 'https://www.google.com';
    return {
      fields: [
        { title: `Kaladesh`, value: `<${u}|$0.16>`, short: true },
        { title: `Magic Origins`, value: `<${u}|$0.24>, <${u}|0.01 tix>`, short: true }
      ],
      title: parts[0].match(/^([^{]+)/)[0].trim(),
      title_link: response.headers['x-scryfall-card'],
      color: COLOR
    };
  }
}

PriceResponse.prototype.middleware = [footer];

class MultiResponse extends TextResponse {

	makeQuerystring() {
    return {
			q: `++${this.cardName}`
		}
	}

	makeAttachment(response) {
    const MAX_COUNT = 25;

    if (response.statusCode !== 200) {
      const err = JSON.parse(response.body);
      return {
        title: `No results for ${this.cardName}, (${err.details ? err.details : 'unknown reason'})`,
        color: COLOR
      }
    }

    const cardList = JSON.parse(response.body);

    if (!cardList.data) {
      return {
        title: `No results for ${this.cardName}`,
        color: COLOR
      }
    }

    const fields = cardList.data.map((card) => {
      return {
        value: `<${card.scryfall_uri}|${card.name}> - ${card.set_name}`,
      };
    }).slice(0, MAX_COUNT);

    return {
      fields: fields,
      title: `${this.cardName} showing ${fields.length} of ${cardList.total_cards}`,
      color: COLOR
    };
  }
}

MultiResponse.prototype.url = 'https://api.scryfall.com/cards/search';
MultiResponse.prototype.middleware = [footer];


module.exports = { TextResponse, ImageResponse, PriceResponse, MultiResponse };
