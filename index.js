'use strict'

const https = require('https')

const api = 'https://tuftsdiningdata.herokuapp.com/rmenus/'

const Alexa = require('alexa-sdk')

const moment = require('moment-timezone')

const APP_ID = undefined  // TODO replace with your app ID (OPTIONAL).

function gradeFood (food, category) {
  let score = 0
  if (category === 'sauces, gravies, & toppings' || category === 'deli & panini') {
    score -= 10
  }
  if (category.match(/bread|accompaniments|sundae|sauces|bar/)) {
    score -= 4
  }
  if (category.match(/dessert|vegetables/)) {
    score += 1
  }
  if (category.match(/entree/)) {
    score += 5
  }
  if (food.match(/with|and|&amp/)) {
    score += 6
  }
  if (food.match(/chicken|beef|steak|shrimp|pork|lamb|salmon|tuna|fish|filet|egg/)) {
    score += 5
  }
  if (food.match(/sauce|dip|topping|gravy|soup|rice|cream/)) {
    score -= 3
  }
  if (food.match(/potato|stir fry|"|vg|veg |vm/)) {
    score -= 2
  }
  return score
}

function queryAPI (hall, date, mealname) {
  return new Promise((resolve, reject) => {
    var url = api + hall + '/' + date.format('D/M/YYYY')
    https.get(url, res => {
      res.setEncoding('utf8')

      var body = ''
      res.on('data', data => {
        body += data
      })

      let allfoods = []
      let Mealname = mealname.charAt(0).toUpperCase() + mealname.slice(1)
      res.on('end', () => {
        body = JSON.parse(body)
        var meal = body.data[Mealname]
        for (var ckey in meal) {
          var category = meal[ckey]
          for (var fkey in category) {
            var food = category[fkey].toLowerCase()
            let grade = gradeFood(food, ckey.toLowerCase())
            allfoods.push({
              food,
              grade
            })
          }
        }
        if (allfoods.length > 0) {
          allfoods.sort()
          // remove duplicates
          let af = allfoods.reduce((acc, val) => {
            if (acc.length === 0 || acc[acc.length - 1].food !== val.food) {
              acc.push(val)
            }
            return acc
          }, [])
          // sort by grade
          af.sort((a, b) => {
            return b.grade - a.grade
          })
          af = af.reduce((acc, val) => {
            if (acc[acc.length - 1] !== val.food) {
              acc.push(val.food)
            }
            return acc
          }, [])
          let menuString = af.join(', ') + ', along with the regular selection of foods'
          resolve(menuString)
        } else {
          resolve(0)
        }
      })
    })
  })
}

const handlers = {
  'LaunchRequest': function () {
    this.emit(':tell', 'Welcome to Tufts Menus')
  },
  'IntentRequest': function () {
    this.emit('GetMenu')
  },
  'SessionEndedRequest': function () {
    this.emit(':tell', 'Goodbye')
  },
  'GetMenu': function () {
    let alexa = this
    let meal = this.event.request.intent.slots.Meal.value
    let hall = this.event.request.intent.slots.Hall.value.toLowerCase()
    let date
    if (this.event.request.intent.slots.Date) {
      date = moment(this.event.request.intent.slots.Date.value).tz('America/New_York')
    } else {
      date = moment().tz('America/New_York')
    }

    // Format output when get requests are done
    queryAPI(hall, date, meal).then(menu => {
      let msg
      if (menu === 0) {
        msg = 'Sorry, the menu you asked for is unavailable.'
      } else {
        msg = 'The menu for ' + hall + ' includes ' + menu
      }
      alexa.emit(':tell', msg)
    })
  },
  'AMAZON.HelpIntent': function () {
    this.emit(':ask', 'Try asking: What is for dinner at Carm today?')
  },
  'AMAZON.CancelIntent': function () {
    this.emit(':tell', 'Goodbye')
  },
  'AMAZON.StopIntent': function () {
    this.emit(':tell', 'Goodbye')
  },
  'Unhandled': function () {
    this.emit(':ask', 'Sorry, I didn\'t get that.')
  }
}

exports.handler = function (event, context) {
  const alexa = Alexa.handler(event, context)
  alexa.APP_ID = APP_ID
  alexa.registerHandlers(handlers)
  alexa.execute()
}
