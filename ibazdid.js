'use strict';

process.env['NTBA_FIX_319'] = 1;
process.env['NTBA_FIX_350'] = 1;
process.env.TZ = 'Asia/Tehran';

var TelegramBot = require('node-telegram-bot-api');
var fs = require('fs');
var mysql = require('mysql');
var momentJalaali = require('moment-jalaali');
var config = require('./config.json');
var messages = require('./messages.json');

var bot = new TelegramBot(config.BOT_TOKEN, {polling: true});

var pool = mysql.createPool({
  host: config.DB_HOST,
  user: config.DB_USERNAME,
  password: config.DB_PASSWORD,
  database: config.DB_NAME
});

// Just for make the bot super speedy!
var ANTI_SPAM = {};
var USERS_INFO = {};
var SEENS = {};
var INITIALIZATION_COMPLETED = false;

// Just for debugging
var REQUEST_PER_SECOND = {};

pool.getConnection(function(err, db) {
  db.query("SELECT ad_id, chat_id FROM ibazdid_seens", function(error, results) {
    results.forEach(function(result) {
      if(typeof SEENS[result.ad_id] === 'undefined') {
        SEENS[result.ad_id] = [];
      }
      SEENS[result.ad_id].push(result.chat_id);
    });
    INITIALIZATION_COMPLETED = true;
  });
});

var KEYBOARD_MAIN = JSON.stringify({
  keyboard: [
    [messages.fa.GET_VIEW_BUTTON],
    [messages.fa.REFERRAL_BUTTON, messages.fa.ADD_AD_BUTTON, messages.fa.USER_INFO_BUTTON],
    [messages.fa.SUPPORT_BUTTON, messages.fa.TRACKING_BUTTON, messages.fa.ATM_BUTTON],
    [messages.fa.TOS_BUTTON, messages.fa.SHOP_BUTTON, messages.fa.BAZAAR_BUTTON]
  ],
  resize_keyboard: true
});

var KEYBOARD_ATM = JSON.stringify({
  keyboard: [
    [
      messages.fa.ATM_INGOING_HISTORY_BUTTON,
      messages.fa.ATM_OUTGOING_HISTORY_BUTTON,
      messages.fa.ATM_TRANSFER_BUTTON
    ],
    [
      messages.fa.RETURN_BUTTON
    ]
  ], resize_keyboard: true
});

var KEYBOARD_AD_PACKAGES = JSON.stringify({
  inline_keyboard: [
    [{
      text: messages.fa.AD_PACKAGE_1, callback_data: 'add_ad_new:' + config.AD_PACKAGE_1_VALUE
    }],
    [{
      text: messages.fa.AD_PACKAGE_2, callback_data: 'add_ad_new:' + config.AD_PACKAGE_2_VALUE
    }],
    [{
      text: messages.fa.AD_PACKAGE_3, callback_data: 'add_ad_new:' + config.AD_PACKAGE_3_VALUE
    }],
    [{
      text: messages.fa.AD_PACKAGE_4, callback_data: 'add_ad_new:' + config.AD_PACKAGE_4_VALUE
    }],
    [{
      text: messages.fa.AD_PACKAGE_5, callback_data: 'add_ad_new:' + config.AD_PACKAGE_5_VALUE
    }],
    [{
      text: messages.fa.AD_PACKAGE_6, callback_data: 'add_ad_new:' + config.AD_PACKAGE_6_VALUE
    }],
    [{
      text: messages.fa.AD_PACKAGE_7, callback_data: 'add_ad_new:' + config.AD_PACKAGE_7_VALUE
    }],
    [{
      text: messages.fa.AD_PACKAGE_8, callback_data: 'add_ad_new:' + config.AD_PACKAGE_8_VALUE
    }]
  ]
});

var KEYBOARD_AD_CONFIRM = JSON.stringify({
  inline_keyboard: [
    [
      {
        text: messages.fa.CONFIRM_YES, callback_data: 'add_ad_confirm:yes'
      },
      {
        text: messages.fa.CONFIRM_NO, callback_data: 'add_ad_confirm:no'
      }
    ]
  ]
});

function KEYBOARD_DELETE_AD_CONFIRM(ad_id) {
  return JSON.stringify({
    inline_keyboard: [
      [
        {
          text: messages.fa.CONFIRM_YES, callback_data: 'l_ad_confirm:' + ad_id
        },
        {
          text: messages.fa.CONFIRM_NO, callback_data: 'l_ad_confirm:no'
        }
      ]
    ]
  });
}

function KEYBOARD_CHECK_SEEN(message_id) {
  return JSON.stringify({
    inline_keyboard: [[
      {
        text: messages.fa.CHECK_SEEN_BUTTON, callback_data: 'seen:' + message_id
      },
      {
        text: messages.fa.REPORT_AD_BUTTON, callback_data: 'report:' + message_id
      },
      {
        text: messages.fa.AD_NITRO_BUTTON, callback_data: 'bazdid_day'
      },
      {
        text: messages.fa.GO_TO_BOT_BUTTON, url: 'https://t.me/' + config.BOT_USERNAME.replace('@', '')
      }
    ]]
  });
}

function KEYBOARD_GO_TO_AD(message_id) {
  return JSON.stringify({
    inline_keyboard: [[
      {
        text: messages.fa.VIEW_AD_BUTTON, url: 'https://t.me/' + config.CHANNEL_ID + '/' + message_id
      }
    ]]
  });
}

function newAd(chat_id, amount) {
  getUserInfo(chat_id, function(info) {
    if(info.credit) {
      if(info.credit >= amount) {
        bot.sendMessage(info.chat_id, messages.fa.AD_FORWARD);
        addPending(info.chat_id, amount);
      }
      else {
        bot.sendMessage(info.chat_id, messages.fa.AD_NOT_ENOUGH_CREDIT, {reply_markup: KEYBOARD_AD_PACKAGES});
      }
    }
  });
}

function addAd(chat_id) {
  getPending(chat_id, function(pending) {
    if(pending.length > 0) {
      pending = pending[0];
      bot.forwardMessage(config.MIDDLE_CHANNEL_ID, chat_id, pending.message_id).then((sent_msg) => {
        bot.forwardMessage(config.CHANNEL_ID, config.MIDDLE_CHANNEL_ID, sent_msg.message_id).then((sent_ad) => {
          bot.sendMessage(chat_id, messages.fa.AD_SUCCESS.replace('{{id}}', sent_ad.message_id), {reply_markup: KEYBOARD_GO_TO_AD(sent_ad.message_id)});
          bot.sendMessage(config.CHANNEL_ID, messages.fa.SEE_IT.replace('{{num}}', pending.credit).toString().toPersianDigits(), {reply_markup: KEYBOARD_CHECK_SEEN(sent_ad.message_id), reply_to_message_id: sent_ad.message_id}).then((sent_reply) => {
            insertAd(chat_id, sent_ad.message_id, sent_reply.message_id, sent_msg.message_id, pending.credit);
          });
        });
        if(pending.credit >= 5000) {
          bot.forwardMessage(config.CUSTOM_ADS_CHANNEL_ID, config.MIDDLE_CHANNEL_ID, sent_msg.message_id);
        }
        deductCredit(chat_id, pending.credit);
        increaseUserAds(chat_id);
        removePending(chat_id);
      });
    }
  });
}

function getSupportMessages(chat_id, callback) {
  pool.getConnection(function(err, db) {
    db.query("SELECT * FROM ibazdid_messages WHERE chat_id = " + chat_id, function(error, result) {
      db.release();
      callback(result);
    });
  });
}

function isMemberExists(chat_id, callback) {
  pool.getConnection(function(err, db) {
    db.query("SELECT chat_id FROM ibazdid_users WHERE chat_id = " + chat_id, function(error, result) {
      db.release();
      callback(result);
    });
  });
}

function getUserInfo(chat_id, callback) {
  if(USERS_INFO[chat_id]) {
    callback(USERS_INFO[chat_id]);
  }
  else {
    pool.getConnection(function(err, db) {
      db.query("SELECT * FROM ibazdid_users WHERE chat_id = " + chat_id, function(error, result) {
        db.release();
        if(result.length > 0) {
          USERS_INFO[chat_id] = result[0];
          callback(result[0]);
        }
        else {
          callback({});
        }
      });
    });
  }
}

function getUserAdsReport(chat_id, callback) {
  pool.getConnection(function(err, db) {
    db.query("SELECT * FROM ibazdid_ads WHERE chat_id = " + chat_id + " ORDER BY message_id LIMIT " + config.ADS_TRACKING_LIMIT, function(error, result) {
      db.release();
      callback(result);
    });
  });
}

function getOutgoingAtmHistory(chat_id, callback) {
  pool.getConnection(function(err, db) {
    db.query("SELECT * FROM ibazdid_transactions WHERE sender = " + chat_id + " ORDER BY date LIMIT " + config.ATM_REPORT_LIMIT, function(error, result) {
      db.release();
      callback(result);
    });
  });
}

function getIngoingAtmHistory(chat_id, callback) {
  pool.getConnection(function(err, db) {
    db.query("SELECT * FROM ibazdid_transactions WHERE receiver = " + chat_id + " ORDER BY date LIMIT " + config.ATM_REPORT_LIMIT, function(error, result) {
      db.release();
      callback(result);
    });
  });
}

function addUser(chat_id) {
  pool.getConnection(function(err, db) {
    db.query("INSERT INTO ibazdid_users (chat_id, registration_date) VALUES (" + chat_id + ", " + Math.floor(Date.now() / 1000) + ")");
    db.release();
  });
}

function setUserStatus(chat_id, status) {
  getUserInfo(chat_id, function(error, results) {
    USERS_INFO[chat_id].status = status;
    pool.getConnection(function(err, db) {
      db.query("UPDATE ibazdid_users SET status = '" + status + "' WHERE chat_id = " + chat_id);
      db.release();
    });
  });
}

function setReferrer(chat_id, referrer) {
  USERS_INFO[chat_id].referrer = referrer;
  pool.getConnection(function(err, db) {
    db.query("UPDATE ibazdid_users SET referrer = " + status + " WHERE chat_id = " + chat_id);
    db.release();
  });
}

function increaseUserAds(chat_id) {
  USERS_INFO[chat_id].ads++;
  pool.getConnection(function(err, db) {
    db.query("UPDATE ibazdid_users SET ads = ads + 1 WHERE chat_id = " + chat_id);
    db.release();
  });
}

function addPending(chat_id, credit, message_id = null) {
  pool.getConnection(function(err, db) {
    getPending(chat_id, function(result) {
      if(result.length > 0) {
        db.query("UPDATE ibazdid_pendings SET credit = " + credit + ", message_id = " + message_id + " WHERE chat_id = " + chat_id);
      }
      else {
        db.query("INSERT INTO ibazdid_pendings (chat_id, credit, message_id) VALUES (" + chat_id + ", " + credit + ", " + message_id + ")");
      }
    });
    db.release();
  });
}

function changePendingMessageId(chat_id, message_id = null) {
  pool.getConnection(function(err, db) {
    db.query("UPDATE ibazdid_pendings SET message_id = " + message_id + " WHERE chat_id = " + chat_id);
    db.release();
  });
}

function getPending(chat_id, callback) {
  pool.getConnection(function(err, db) {
    db.query("SELECT * FROM ibazdid_pendings WHERE chat_id = " + chat_id, function(error, result) {
      db.release();
      callback(result);
    });
  });
}

function removePending(chat_id, status) {
  pool.getConnection(function(err, db) {
    db.query("DELETE FROM ibazdid_pendings WHERE chat_id = " + chat_id);
    db.release();
  });
}

function addCredit(chat_id, amount) {
  if(!USERS_INFO[chat_id]) {
    getUserInfo(chat_id, function(result) {
      USERS_INFO[chat_id].credit += amount;
    });
  }
  else {
    USERS_INFO[chat_id].credit += amount;
  }
  pool.getConnection(function(err, db) {
    db.query("UPDATE ibazdid_users SET credit = credit + " + amount + " WHERE chat_id = " + chat_id);
    db.release();
  });
}

function deductCredit(chat_id, amount) {
  USERS_INFO[chat_id].credit -= amount;
  pool.getConnection(function(err, db) {
    db.query("UPDATE ibazdid_users SET credit = credit - " + amount + " WHERE chat_id = " + chat_id);
    db.release();
  });
}

function addTransaction(transaction_id, amount, sender, receiver) {
  pool.getConnection(function(err, db) {
    db.query("INSERT INTO ibazdid_transactions (transaction_id, date, amount, sender, receiver) VALUES (" + transaction_id + ", " + Math.floor(Date.now() / 1000) + ", " + amount + ", " + sender + ", " + receiver + ")");
    db.release();
  });
}

function insertAd(chat_id, message_id, reply_id, tracking_id, credit) {
  pool.getConnection(function(err, db) {
    db.query("INSERT INTO ibazdid_ads (chat_id, message_id, reply_id, tracking_id, credit, time) VALUES (" + chat_id + ", " + message_id + ", " + reply_id + ", " + tracking_id + ", " + credit + ", " + Math.floor(Date.now() / 1000) + ")");
    db.release();
  });
}

function addMessage(chat_id, message) {
  pool.getConnection(function(err, db) {
    db.query("INSERT INTO ibazdid_messages (chat_id, date, message) VALUES (" + chat_id + ", " + Math.floor(Date.now() / 1000) + ", '" + message + "')");
    db.release();
  });
}

function addSeen(chat_id, ad_id, callback_query) {
  if(INITIALIZATION_COMPLETED == true) {
      if(typeof SEENS[ad_id] === 'undefined' || !inArray(chat_id, SEENS[ad_id])) {
        if(typeof SEENS[ad_id] === 'undefined') {
          SEENS[ad_id] = [];
        }
        SEENS[ad_id].push(chat_id);
        getUserInfo(chat_id, function(info) {
          if(typeof info.chat_id !== 'undefined') {
            if(typeof info.vip_time !== 'undefined' && info.vip_time > Math.floor(new Date() / 1000) && info.vip_panel > info.panel) {
              bot.answerCallbackQuery(callback_query, {text: messages.fa.SEEN_SUCCESS.replace('{{credit}}', (info.credit + roundDown(config.PLANS_COMMISSION[info.vip_panel], 1)).toString().toPersianDigits())});
              var time = Math.floor(Date.now() / 1000);
              if(typeof REQUEST_PER_SECOND[time] === 'undefined') {
                REQUEST_PER_SECOND[time] = 0;
              }
              REQUEST_PER_SECOND[time]++;
              console.log(REQUEST_PER_SECOND);
              USERS_INFO[chat_id].credit += config.PLANS_COMMISSION[info.vip_panel];
              addCredit(chat_id, config.PLANS_COMMISSION[info.vip_panel]);
            }
            else {
              bot.answerCallbackQuery(callback_query, {text: messages.fa.SEEN_SUCCESS.replace('{{credit}}', info.credit + config.PLANS_COMMISSION[info.panel])});
              var time = Math.floor(Date.now() / 1000);
              if(typeof REQUEST_PER_SECOND[time] === 'undefined') {
                REQUEST_PER_SECOND[time] = 0;
              }
              REQUEST_PER_SECOND[time]++;
              console.log(REQUEST_PER_SECOND);
              USERS_INFO[chat_id].credit += config.PLANS_COMMISSION[info.panel];
              addCredit(chat_id, config.PLANS_COMMISSION[info.panel]);
            }
            if(!isNaN(info.referrer) && info.referrer > 0) {
              db.query("UPDATE ibazdid_users SET referral_visits = referral_visits + 1, commission = commission + " + config.COMMISSION_RATIO + ", credit = credit + " + config.COMMISSION_RATIO + " WHERE chat_id = " + info.referrer);
              if(info.earned_credit == 0) {
                bot.sendMessage(info.referrer, messages.fa.REFERRAL_BONUS.replace('{{bonus}}', config.REFERRAL_BONUS.toString().toPersianDigits()));
                pool.getConnection(function(err, db) {
                  db.query("UPDATE ibazdid_users SET credit = credit + " + config.REFERRAL_BONUS + ", gifted_credit = gifted_credit + " + config.REFERRAL_BONUS + " WHERE chat_id = " + info.referrer, function(error, result) {
                    db.release();
                  });
                });
              }
            }
            if(info.last_visit == getToday()) {
              USERS_INFO[chat_id].today_visits++;
              pool.getConnection(function(err, db) {
                db.query("UPDATE ibazdid_users SET today_visits = today_visits + 1 WHERE chat_id = " + info.chat_id, function(error, result) {
                  db.release();
                });
              });
            }
            else if(info.last_visit == getYesterday()) {
              USERS_INFO[chat_id].today_visits = 1;
              USERS_INFO[chat_id].yerterdayvisits = USERS_INFO[chat_id].today_visits;
              USERS_INFO[chat_id].last_visit = getToday();
              pool.getConnection(function(err, db) {
                db.query("UPDATE ibazdid_users SET today_visits = 1, yerterdayvisits = " + info.today_visits + ", last_visit = " + getToday() + " WHERE chat_id = " + info.chat_id, function(error, result) {
                  db.release();
                });
              });
            }
            else {
              USERS_INFO[chat_id].today_visits = 1;
              USERS_INFO[chat_id].yerterdayvisits = 0;
              USERS_INFO[chat_id].last_visit = getToday();
              pool.getConnection(function(err, db) {
                db.query("UPDATE ibazdid_users SET today_visits = 1, yerterdayvisits = 0, last_visit = " + getToday() + " WHERE chat_id = " + info.chat_id, function(error, result) {
                  db.release();
                });
              });
            }
          }
          else {
            pool.getConnection(function(err, db) {
              db.query("INSERT INTO ibazdid_users (chat_id, registration_date, credit, gifted_credit, today_visits) VALUES (" + chat_id + ", " + Math.floor(Date.now() / 1000) + ", " + config.INITIAL_CREDIT + ", " + config.INITIAL_CREDIT + ", 1)", function(error, result) {
                db.release();
              });
            });
          }
          pool.getConnection(function(err, db) {
            db.query("INSERT INTO ibazdid_seens (chat_id, ad_id) VALUES (" + chat_id + ", " + ad_id + ")", function(error, result) {
              db.release();
            });
          });
        });
        pool.getConnection(function(err, db) {
          db.query("UPDATE ibazdid_ads SET seens = seens + 1 WHERE message_id = " + ad_id);
          db.query("SELECT * FROM ibazdid_ads WHERE message_id = " + ad_id, function(errors, ad) {
            if(ad.length > 0) {
              ad = ad[0];
              if(ad.seens >= ad.credit) {
                bot.sendMessage(ad.chat_id, messages.fa.AD_COMPLETED.replace('{{id}}', ad_id));
                bot.deleteMessage(config.CHANNEL_ID, ad_id);
                bot.deleteMessage(config.CHANNEL_ID, ad.reply_id);
                db.query("UPDATE ibazdid_ads SET completed = 1 WHERE message_id = " + ad_id);
                db.query("DELETE FROM ibazdid_seens WHERE ad_id = " + ad_id);
              }
            }
            db.release();
          });
        });
      }
      else {
        bot.answerCallbackQuery(callback_query, {text: messages.fa.SEEN_BEFORE});
      }
  }
}

function nitro(chat_id, callback_query) {
  pool.getConnection(function(err, db) {
    getUserInfo(chat_id, function(info) {
      if(info.length > 0) {
        for(var i = 0; i <= config.NITRO_PACKAGES.length; i++) {
          if(info.nitro == i) {
            if(info.nitro == config.NITRO_PACKAGES.length) {
              bot.answerCallbackQuery(callback_query, {text: messages.fa.NITRO_FINISHED});
            }
            else if(info.today_visits >= config.NITRO_PACKAGES[i]) {
              bot.answerCallbackQuery(callback_query, {text: messages.fa.NITRO_SUCCESS.replace('{{credit}}', roundDown(config.NITRO_GIFTS[i].toString().toPersianDigits(), 1))});
              addCredit(chat_id, config.NITRO_GIFTS[i]);
              USERS_INFO[chat_id].nitro++;
              db.query("UPDATE ibazdid_users SET nitro = nitro + 1 WHERE chat_id = " + chat_id);
            }
            else {
              bot.answerCallbackQuery(callback_query, {text: messages.fa.NITRO_NOT_ENOUGH.replace('{{seens}}', (config.NITRO_PACKAGES[i] - info.today_visits).toString().toPersianDigits())});
            }
            break;
          }
        }
      }
      else {
        db.query("INSERT INTO ibazdid_users (chat_id, registration_date, credit, gifted_credit, today_visits) VALUES (" + chat_id + ", " + Math.floor(Date.now() / 1000) + ", " + config.INITIAL_CREDIT + ", " + config.INITIAL_CREDIT + ", 1)");
        bot.answerCallbackQuery(callback_query, {text: messages.fa.NITRO_NOT_ENOUGH.replace('{{seens}}', (config.NITRO_PACKAGES[0] - 1).toString().toPersianDigits())});
      }
    });
    db.release();
  });
}

function reportAd(chat_id, ad_id, callback_query) {
  pool.getConnection(function(err, db) {
    db.query("SELECT chat_id FROM ibazdid_reports WHERE chat_id = " + chat_id + " AND ad_id = " + ad_id, function(error, result) {
      if(result.length == 0) {
        bot.answerCallbackQuery(callback_query, {text: messages.fa.REPORT_AD_SUCCESS});
        db.query("INSERT INTO ibazdid_reports (chat_id, ad_id) VALUES (" + chat_id + ", " + ad_id + ")");
      }
      else {
        bot.answerCallbackQuery(callback_query, {text: messages.fa.REPORT_AD_BEFORE});
      }
      db.release();
    });
  });
}

function getToday() {
  var datetime = new Date(); 
  return datetime.toLocaleDateString();
}

function getYesterday() {
  var datetime = new Date();
  datetime.setDate(datetime.getDate() - 1);  
  return datetime.toLocaleDateString();
}

String.prototype.toPersianDigits = function() {
  var id = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return this.replace(/[0-9]/g, function(w) {
    return id[+w]
  });
}

function generateRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundDown(number, decimals) {
    decimals = decimals || 0;
    return Math.floor(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function unixToJalali(time, format = 'jYYYY/jM/jD') {
  var m = momentJalaali(new Date(time * 1000));
  m.format(format);
  return m.format(format);
}

function inArray(needle, haystack) {
  var length = haystack.length;
  for(var i = 0; i < length; i++) {
    if(haystack[i] == needle) return true;
  }
  return false;
}

function getTrackingAd(chat_id, ad_id, callback) {
  pool.getConnection(function(err, db) {
    db.query("SELECT * FROM ibazdid_ads WHERE chat_id = " + chat_id + " AND message_id = " + ad_id, function(error, result) {
      db.release();
      callback(result);
    });
  });
}

bot.on('text', (message) => {
  var chat_id = message.chat.id;
  var message_id = message.message_id;
  var text = message.text;
  if(!ANTI_SPAM[chat_id] || (ANTI_SPAM[chat_id] && (Date.now() - ANTI_SPAM[chat_id]) >= config.ANTI_SPAM_OFFSET)) {
    if(text.split(' ')[0] == '/start') {
      var referrer = text.split(' ');
      bot.sendMessage(chat_id, messages.fa.START, {reply_markup: KEYBOARD_MAIN});
      isMemberExists(chat_id, function(newMember) {
        if(newMember.length == 0) {
          bot.sendMessage(chat_id, messages.fa.NEW_USER_GIFT, {reply_markup: KEYBOARD_MAIN});
          addUser(chat_id);
          if(referrer.length > 1) {
            referrer = referrer[1];
            if(!inNaN(referrer) && referrer != chat_id) {
              setReferrer(chat_id, referrer);
            }
          }
        }
        else {
          setUserStatus(chat_id, '');
        }
      });
      removePending(chat_id);
      ANTI_SPAM[chat_id] = Date.now();
    }
    else if(/\/ad_([0-9]+)/i.test(text)) {
      var ad_id = text.match(/ad_([0-9]+)/i);
      if(ad_id.length > 1) {
        getTrackingAd(chat_id, ad_id[1], function(ad) {
          if(ad.length > 0) {
            bot.forwardMessage(chat_id, config.MIDDLE_CHANNEL_ID, ad[0].tracking_id);
          }
          else {
            bot.sendMessage(chat_id, messages.fa.AD_TRACKING_NOT_FOUND);
          }
        });
      }
    }
    else if(/\/l_([0-9]+)/i.test(text)) {
      var ad_id = text.match(/l_([0-9]+)/i);
      if(ad_id.length > 1) {
        getTrackingAd(chat_id, ad_id[1], function(ad) {
          if(ad.length > 0 && ad[0].completed == 0) {
            ad = ad[0];
            if(ad.tracking_id) {
              bot.forwardMessage(chat_id, config.MIDDLE_CHANNEL_ID, ad.tracking_id).then((sent) => {
                bot.sendMessage(chat_id, messages.fa.AD_DELETE_CONFIRM.replace('{{ad}}', ad.message_id).toString().toPersianDigits(), {reply_markup: KEYBOARD_DELETE_AD_CONFIRM(ad.message_id), reply_to_message_id: sent.message_id});
              });
            }
            else {
              bot.sendMessage(chat_id, messages.fa.AD_DELETE_CONFIRM.replace('{{ad}}', ad.message_id).toString().toPersianDigits(), {reply_markup: KEYBOARD_DELETE_AD_CONFIRM(ad.message_id)});
            }
          }
          else {
            bot.sendMessage(chat_id, messages.fa.AD_TRACKING_NOT_FOUND);
          }
        });
      }
    }
    else {
      bot.getChatMember(config.CHANNEL_TO_JOIN_ID, chat_id).then(function(chatMember) {
        if(chatMember.status == 'creator' || chatMember.status == 'administrator' || chatMember.status == 'member') {
          getUserInfo(chat_id, function(info) {
            var BOT_BUTTONS = [
              messages.fa.GET_VIEW_BUTTON,
              messages.fa.USER_INFO_BUTTON,
              messages.fa.ADD_AD_BUTTON,
              messages.fa.REFERRAL_BUTTON,
              messages.fa.ATM_BUTTON,
              messages.fa.TRACKING_BUTTON,
              messages.fa.SUPPORT_BUTTON,
              messages.fa.BAZAAR_BUTTON,
              messages.fa.SHOP_BUTTON,
              messages.fa.TOS_BUTTON,
              messages.fa.ATM_TRANSFER_BUTTON,
              messages.fa.ATM_OUTGOING_HISTORY_BUTTON,
              messages.fa.ATM_INGOING_HISTORY_BUTTON,
              messages.fa.RETURN_BUTTON
            ];
            if(inArray(text, BOT_BUTTONS)) {
              setUserStatus(chat_id, '');
              removePending(chat_id);
            }
            if(info.status) {
              if(text == messages.fa.RETURN_BUTTON) {
                bot.sendMessage(chat_id, messages.fa.RETURN, {reply_markup: KEYBOARD_MAIN});
                setUserStatus(chat_id, '');
                ANTI_SPAM[chat_id] = Date.now();
              }
              else {
                var action = info.status.split(':')[0];
                switch(action) {
                  case 'sendcreditamount':
                    if(!isNaN(text)) {
                      text = roundDown(text);
                      if(text > 0 && text <= info.credit - config.INITIAL_CREDIT) {
                        bot.sendMessage(chat_id, messages.fa.ATM_ENTER_RECEIVER);
                        setUserStatus(chat_id, 'sendaccount:' + text);
                      }
                      else {
                        bot.sendMessage(chat_id, messages.fa.ATM_INVALID_AMOUNT);
                      }
                    }
                    else {
                      bot.sendMessage(chat_id, messages.fa.ATM_INVALID_AMOUNT);
                    }
                    ANTI_SPAM[chat_id] = Date.now();
                    break;
                  case 'sendaccount':
                    if(!isNaN(text) && text != chat_id) {
                      isMemberExists(text, function(result) {
                        if(result.length > 0) {
                          var amount = info.status.split(':')[1];
                          var transaction_id = generateRandomNumber(1000000000, 9999999999);
                          bot.sendMessage(chat_id, messages.fa.ATM_SUCCESS_SENDER.replace('{{amount}}', amount.toPersianDigits()).replace('{{receiver}}', text).replace('{{transaction_id}}', transaction_id));
                          bot.sendMessage(text, messages.fa.ATM_SUCCESS_RECEIVER.replace('{{amount}}', amount.toPersianDigits()).replace('{{sender}}', chat_id).replace('{{transaction_id}}', transaction_id));
                          setUserStatus(chat_id, '');
                          deductCredit(chat_id, amount);
                          addCredit(text, amount);
                          addTransaction(transaction_id, amount, chat_id, text);
                        }
                        else {
                          bot.sendMessage(chat_id, messages.fa.ATM_INVALID_RECEIVER);
                        }
                      });
                    }
                    else {
                      bot.sendMessage(chat_id, messages.fa.ATM_INVALID_RECEIVER);
                    }
                    ANTI_SPAM[chat_id] = Date.now();
                    break;
                  case 'custom_pkg':
                    if(!isNaN(text)) {
                      if(text <= config.CUSTOM_PACKAGE_MAX && text >= config.CUSTOM_PACKAGE_MIN) {
                        newAd(chat_id, text);
                      }
                      else {
                        bot.sendMessage(chat_id, messages.fa.CUSTOM_PACKAGE_INVALID.replace('{{min}}', config.CUSTOM_PACKAGE_MIN).replace('{{max}}', config.CUSTOM_PACKAGE_MAX));
                      }
                    }
                    ANTI_SPAM[chat_id] = Date.now();
                    break;
                  case 'waiting4message':
                    bot.sendMessage(chat_id, messages.fa.SUPPORT_MESSAGE_SENT);
                    config.ADMINS.forEach(function(admin) {
                      bot.sendMessage(admin, messages.fa.ADMIN_SUPPORT_NEW_MESSAGE, {reply_markup: JSON.stringify({inline_keyboard: [[{text: messages.fa.ADMIN_SUPPORT_MESSAGES_BUTTON, callback_data: 'admin_unread'}]]})});
                    });
                    setUserStatus(chat_id, '');
                    addMessage(chat_id, text);
                    ANTI_SPAM[chat_id] = Date.now();
                    break;
                }
              }
            }
            else {
              switch(text) {
                case messages.fa.REFERRAL_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.REFERRAL.replace('{{id}}', chat_id), {reply_markup: JSON.stringify({inline_keyboard: [[{text: messages.fa.GET_REFERRAL_BANNER_BUTTON, callback_data: 'getBanner:' + chat_id}]]})});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.GET_VIEW_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.GET_VIEW, {reply_markup: JSON.stringify({inline_keyboard: [[{text: messages.fa.GO_TO_CHANNEL_BUTTON, url: messages.fa.GO_TO_CHANNEL_URL}]]})});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.ADD_AD_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.ADD_AD, {reply_markup: KEYBOARD_AD_PACKAGES});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.ATM_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.ATM, {reply_markup: KEYBOARD_ATM});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.TRACKING_BUTTON:
                  getUserAdsReport(chat_id, function(ads) {
                    if(ads.length > 0) {
                      var ads_report_text = messages.fa.ADS_TRACKING_HEADER + "\n\n";
                      for(var i = 0; i < ads.length; i++) {
                        var ad = ads[i];
                        var status;
                        switch(ad.completed) {
                          case 1:
                            status = messages.fa.ADS_TRACKING_STATUS_FINISHED;
                            break;
                          case 0:
                            status = messages.fa.ADS_TRACKING_STATUS_ONGOING;
                            break;
                          case -1:
                            status = messages.fa.ADS_TRACKING_STATUS_CANCELED;
                            break;
                        }
                        ads_report_text += messages.fa.ADS_TRACKING_ITEM
                          .replace('{{number}}', (i + 1).toString().toPersianDigits())
                          .replace(/{{id}}/g, ad.message_id)
                          .replace('{{date}}', unixToJalali(ad.time).toPersianDigits())
                          .replace('{{credit}}', ad.credit.toString().toPersianDigits())
                          .replace('{{seens}}', ad.seens.toString().toPersianDigits())
                          .replace('{{status}}', status);
                        if(ad.completed == 0) {
                          ads_report_text += "\n" + messages.fa.ADS_TRACKING_CANCEL.replace('{{id}}', ad.message_id);
                        }
                        ads_report_text += "\n" + "-----------------------------";
                      }
                      bot.sendMessage(chat_id, ads_report_text);
                    }
                    else {
                      bot.sendMessage(chat_id, messages.fa.ADS_TRACKING_NO_ADS);
                    }
                  });
                  break;
                case messages.fa.USER_INFO_BUTTON:
                  if(info.vip_panel > info.panel) {
                    var panel = info.vip_panel;
                  }
                  else {
                    var panel = info.panel;
                  }
                  if(info.panel_time > (Math.floor(Date.now() / 1000))) {
                    var panel_time = roundDown((Math.floor(Date.now() / 1000) - info.vip_time) / 86400).toString().toPersianDigits() + ' ' + messages.fa.DAY;
                  }
                  else {
                    var panel = info.panel;
                    var panel_time = messages.fa.PERMANENT;
                  }
                  bot.sendMessage(chat_id, messages.fa.USER_INFO
                    .replace('{{chat_id}}', info.chat_id)
                    .replace('{{panel}}', messages.fa.PLANS_NAMES[panel])
                    .replace('{{panel_time}}', panel_time)
                    .replace('{{registration_date}}', unixToJalali(info.registration_date))
                    .replace('{{earned_credit}}', info.earned_credit)
                    .replace('{{earned_credit_today}}', info.today_visits)
                    .replace('{{earned_credit_yesterday}}', info.yesterday_visits)
                    .replace('{{earned_credit_week}}', info.today_visits + info.yesterday_visits + info.day3_visits + info.day4_visits + info.day5_visits + info.day6_visits + info.day7_visits)
                    .replace('{{received_credit}}', info.received_credit)
                    .replace('{{used_credit}}', info.used_credit)
                    .replace('{{transferred_credit}}', info.transferred_credit)
                    .replace('{{gifted_credit}}', info.gifted_credit)
                    .replace('{{shop_credit}}', info.shop_credit)
                    .replace('{{referrals_count}}', info.referrals_count)
                    .replace('{{active_referrals}}', info.active_referrals)
                    .replace('{{referrals_visits}}', info.referrals_visits)
                    .replace('{{commission}}', info.commission)
                    .replace('{{credit}}', info.credit)
                    .toString().toPersianDigits()
                    , {reply_markup: KEYBOARD_MAIN});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.SUPPORT_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.SUPPORT, {reply_markup: JSON.stringify({
                    inline_keyboard: [
                    [{
                      text: messages.fa.SUPPORT_SEND_MESSAGE_BUTTON, callback_data: 'support:newMessage'
                    }],
                    [{
                      text: messages.fa.SUPPORT_INBOX_BUTTON, callback_data: 'support:inbox'
                    }]
                  ]})});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.BAZAAR_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.BAZAAR, {reply_markup: KEYBOARD_MAIN});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.SHOP_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.SHOP, {reply_markup: JSON.stringify({
                    inline_keyboard: [
                    [
                      {
                        text: messages.fa.UPGRADE_PANEL_BUTTON, callback_data: 'up_panel'
                      },
                      {
                        text: messages.fa.BUY_VIEW_BUTTON, callback_data: 'shop_bazdid'
                      }
                    ]
                  ]})});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.TOS_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.TOS, {reply_markup: KEYBOARD_MAIN});
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.RETURN_BUTTON:
                  bot.sendMessage(chat_id, messages.fa.RETURN, {reply_markup: KEYBOARD_MAIN});
                  setUserStatus(chat_id, '');
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.ATM_OUTGOING_HISTORY_BUTTON:
                  getOutgoingAtmHistory(chat_id, function(result) {
                    if(result.length > 0) {
                      var outgoing_history_text = '';
                      result.forEach(function(element) {
                        outgoing_history_text += messages.fa.ATM_OUTGOING_HISTORY.replace('{{receiver}}', element.receiver).replace('{{amount}}', element.amount).replace('{{date}}', unixToJalali(element.date));
                      });
                      bot.sendMessage(chat_id, outgoing_history_text, {reply_markup: KEYBOARD_ATM});
                    }
                    else {
                      bot.sendMessage(chat_id, messages.fa.ATM_OUTGOING_EMPTY, {reply_markup: KEYBOARD_ATM});
                    }
                  });
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.ATM_INGOING_HISTORY_BUTTON:
                  getIngoingAtmHistory(chat_id, function(result) {
                    if(result.length > 0) {
                      var ingoing_history_text = '';
                      result.forEach(function(element) {
                        ingoing_history_text += messages.fa.ATM_INGOING_HISTORY.replace('{{sender}}', element.sender).replace('{{amount}}', element.amount).replace('{{date}}', unixToJalali(element.date));
                      });
                      bot.sendMessage(chat_id, ingoing_history_text, {reply_markup: KEYBOARD_ATM});
                    }
                    else {
                      bot.sendMessage(chat_id, messages.fa.ATM_INGOING_EMPTY, {reply_markup: KEYBOARD_ATM});
                    }
                  });
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
                case messages.fa.ATM_TRANSFER_BUTTON:
                  if(Math.floor(info.credit) > config.INITIAL_CREDIT) {
                    bot.sendMessage(chat_id, messages.fa.ATM_TRANSFER_ENTER_AMOUNT.replace('{{max}}', roundDown(info.credit - config.INITIAL_CREDIT)).toString().toPersianDigits(), {reply_markup: KEYBOARD_ATM});
                    setUserStatus(chat_id, 'sendcreditamount');
                    removePending(chat_id);
                  }
                  else {
                    bot.sendMessage(chat_id, messages.fa.ATM_TRANSFER_NOT_ENOUGH_CREDIT.replace('{{credit}}', config.INITIAL_CREDIT).toString().toPersianDigits(), {reply_markup: KEYBOARD_ATM});
                  }
                  ANTI_SPAM[chat_id] = Date.now();
                  break;
              }
            }
          });
        }
        else {
          bot.sendMessage(chat_id, messages.fa.JOIN_CHANNEL);
          ANTI_SPAM[chat_id] = Date.now();
        }
      });
    }
  }
});

bot.on('callback_query', (callback_query) => {
  var query_id = callback_query.id;
  var query = callback_query.data;
  var message = callback_query.message;
  var message_id = message.message_id;
  var chat_id = message.chat.id;
  var from_id = callback_query.from.id;
  if(!ANTI_SPAM[from_id] || (ANTI_SPAM[from_id] && (Date.now() - ANTI_SPAM[from_id]) >= config.ANTI_SPAM_OFFSET)) {
    var action = query.split(':')[0];
    switch(action) {
      case 'getBanner':
        var user = query.split(':')[1];
        bot.sendPhoto(user, config.IMAGE_BANNER_FILE_ID, {caption: messages.fa.REFERRAL_BANNER_CAPTION.replace('{{id}}', user)});
        bot.sendDocument(user, config.GIF_BANNER_FILE_ID, {caption: messages.fa.REFERRAL_BANNER_CAPTION.replace('{{id}}', user)});
        bot.answerCallbackQuery(query_id);
        break;
      case 'shop_bazdid':
        var shop_packages_buttons = [];
        for(var i = 0; i < messages.fa.SHOP_PACKAGES_BUTTONS.length; i++) {
          shop_packages_buttons.push([{text: messages.fa.SHOP_PACKAGES_BUTTONS[i], url: config.SHOP_PACKAGE_URL.replace('{{chat_id}}', chat_id).replace('{{package}}', i + 1)}]);
        };
        var shop_packages_keyboard = JSON.stringify({inline_keyboard: shop_packages_buttons});
        bot.sendMessage(chat_id, messages.fa.SHOP_BUY_VIEW, {reply_markup: shop_packages_keyboard});
        bot.answerCallbackQuery(query_id);
        break;
      case 'up_panel':
        var shop_panels_buttons = [];
        for(var i = 0; i < messages.fa.SHOP_PANELS_BUTTONS.length; i++) {
          shop_panels_buttons.push([{text: messages.fa.SHOP_PANELS_BUTTONS[i], url: config.SHOP_UPGRADE_PANEL_URL.replace('{{chat_id}}', chat_id).replace('{{package}}', i + 1)}]);
        };
        var shop_panels_keyboard = JSON.stringify({inline_keyboard: shop_panels_buttons});
        bot.sendMessage(chat_id, messages.fa.SHOP_UPGRADE_PANEL, {reply_markup: shop_panels_keyboard});
        bot.answerCallbackQuery(query_id);
        break;
      case 'add_ad_new':
        var value = query.split(':')[1];
        if(value == 'custom') {
          bot.sendMessage(chat_id, messages.fa.CUSTOM_PACKAGE.replace('{{min}}', config.CUSTOM_PACKAGE_MIN).replace('{{max}}', config.CUSTOM_PACKAGE_MAX));
          bot.answerCallbackQuery(query_id);
          setUserStatus(chat_id, 'custom_pkg');
          removePending(chat_id);
        }
        else {
          newAd(chat_id, value);
          bot.answerCallbackQuery(query_id);
        }
        break;
      case 'add_ad_confirm':
        var value = query.split(':')[1];
        if(value == 'yes') {
          addAd(chat_id);
          bot.answerCallbackQuery(query_id);
          setUserStatus(chat_id, '');
        }
        else {
          bot.sendMessage(chat_id, messages.fa.CANCELED);
          bot.answerCallbackQuery(query_id);
          removePending(chat_id);
        }
        break;
      case 'l_ad_confirm':
        var value = query.split(':')[1];
        if(value != 'no') {
          getTrackingAd(chat_id, value, function(ad) {
            if(ad.length > 0) {
              ad = ad[0];
              if(ad.completed == 0) {
                var credit = ad.credit - ad.seens;
                bot.deleteMessage(config.CHANNEL_ID, ad.message_id);
                bot.deleteMessage(config.CHANNEL_ID, ad.reply_id);
                bot.sendMessage(chat_id, messages.fa.AD_CANCELED.replace('{{credit}}', credit.toString().toPersianDigits()));
                bot.sendMessage(config.LOGS_CHANNEL_ID, messages.fa.AD_CANCELED_ADMIN
                  .replace('{{credit}}', credit.toString().toPersianDigits())
                  .replace('{{ad_id}}', ad.message_id)
                  .replace('{{chat_id}}', chat_id)
                );
                addCredit(chat_id, credit);
                pool.getConnection(function(err, db) {
                  db.query("UPDATE ibazdid_ads SET completed = -1 WHERE message_id = " + ad.message_id, function(err, result) {
                    db.release();
                  });
                });
              }
              else {
                bot.sendMessage(chat_id, messages.fa.AD_TRACKING_CANCELED_BEFORE);
              }
            }
          });
        }
        else {
          bot.sendMessage(chat_id, messages.fa.CANCELED);
          bot.answerCallbackQuery(query_id);
        }
        bot.answerCallbackQuery(query_id);
        break;
      case 'seen':
        var value = query.split(':')[1];
        addSeen(from_id, value, query_id);
        break;
      case 'bazdid_day':
        nitro(from_id, query_id);
        break;
      case 'report':
        var value = query.split(':')[1];
        reportAd(from_id, value, query_id);
        break;
      case 'support':
        var value = query.split(':')[1];
        if(value == 'newMessage') {
          bot.sendMessage(chat_id, messages.fa.SUPPORT_SEND_YOUR_MESSAGE);
          bot.answerCallbackQuery(query_id);
          setUserStatus(chat_id, 'waiting4message');
        }
        else {
          getSupportMessages(chat_id, function(results) {
            if(results.length > 0) {
              var messages_text = '';
              results.forEach(function(element) {
                if(typeof element.reply !== 'undefined' || element.reply.length == 0) {
                  element.reply = messages.fa.SUPPORT_INBOX_NO_REPLY;
                }
                messages_text += messages.fa.SUPPORT_MESSAGE.replace('{{message}}', element.message).replace('{{reply}}', element.reply);
              });
              bot.sendMessage(chat_id, messages_text);
            }
            else {
              bot.sendMessage(chat_id, messages.fa.SUPPORT_NO_MESSAGE);
            }
          });
          bot.answerCallbackQuery(query_id);
        }
        break;
    }
    ANTI_SPAM[from_id] = Date.now();
  }
});

bot.on('message', (message) => {
  var chat_id = message.chat.id;
  var message_id = message.message_id;
  var BOT_BUTTONS = [
    messages.fa.GET_VIEW_BUTTON,
    messages.fa.USER_INFO_BUTTON,
    messages.fa.ADD_AD_BUTTON,
    messages.fa.REFERRAL_BUTTON,
    messages.fa.ATM_BUTTON,
    messages.fa.TRACKING_BUTTON,
    messages.fa.SUPPORT_BUTTON,
    messages.fa.BAZAAR_BUTTON,
    messages.fa.SHOP_BUTTON,
    messages.fa.TOS_BUTTON,
    messages.fa.ATM_TRANSFER_BUTTON,
    messages.fa.ATM_OUTGOING_HISTORY_BUTTON,
    messages.fa.ATM_INGOING_HISTORY_BUTTON,
    messages.fa.RETURN_BUTTON
  ];
  if(typeof message.text === 'undefined' || (typeof message.text !== 'undefined' && !inArray(message.text, BOT_BUTTONS))) {
    getPending(chat_id, function(pending) {
      if(pending.length > 0) {
        if(!ANTI_SPAM[chat_id] || (ANTI_SPAM[chat_id] && (Date.now() - ANTI_SPAM[chat_id]) >= config.ANTI_SPAM_OFFSET)) {
          pending = pending[0];
          if(typeof message.forward_date !== 'undefined') {
            var text = '';
            if(typeof message.text !== 'undefined') {
              text = message.text;
            }
            else if(typeof message.caption !== 'undefined') {
              text = message.caption;
            }
            if(config.BANNED_WORDS.some(function(v) { return text.indexOf(v) >= 0; })) {
              bot.sendMessage(chat_id, messages.fa.BANNED_AD);
            }
            else {
              bot.sendMessage(chat_id, messages.fa.AD_CONFIRM.replace('{{credit}}', pending.credit).toString().toPersianDigits(), {reply_markup: KEYBOARD_AD_CONFIRM});
              changePendingMessageId(chat_id, message_id);
              setUserStatus(chat_id, '');
            }
          }
          else {
            bot.sendMessage(chat_id, messages.fa.INVALID_AD);
          }
          ANTI_SPAM[chat_id] = Date.now();
        }
      }
    });
  }
});