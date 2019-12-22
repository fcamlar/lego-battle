/*
 * This are the resources part of the Lambda function that represents the endpoint of the Alexa Lego Mindstorms challenge skill.
 * The code can be copied and used without restriction.
 * This skill send directives and receive events from the Lego Mindstorm Brick Echo connected gadget.
 * The code may contain parts copied from Alexa Lego Mindstorms mission 4.
 */
'use strict'

const Alexa = require('ask-sdk-core');
const speech_en_US = require("./speech/en-US.json");
const speech_es_ES = require("./speech/es-ES.json");

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        let speech;
        switch (handlerInput.requestEnvelope.request.locale) {
            case "en-US":
                speech = speech_en_US;
                break;
            case "es-ES":
                speech = speech_es_ES;
                break;
            default:
                speech = speech_en_US;
        }
        const speakOutput = speech.speakHelp;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
                Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        let speech;
        switch (handlerInput.requestEnvelope.request.locale) {
            case "en-US":
                speech = speech_en_US;
                break;
            case "es-ES":
                speech = speech_es_ES;
                break;
            default:
                speech = speech_en_US;
        }
        const speakOutput = speech.speakCancelAndStopSpeechOutput;
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder
            .withShouldEndSession(true)
            .getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        let speech;
        switch (handlerInput.requestEnvelope.request.locale) {
            case "en-US":
                speech = speech_en_US;
                break;
            case "es-ES":
                speech = speech_es_ES;
                break;
            default:
                speech = speech_en_US;
        }
        const speakOutput = speech.speakError;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// The request interceptor is used for request handling testing and debugging.
// It will simply log the request in raw json format before any processing is performed.
const RequestInterceptor = {
    process(handlerInput) {
        let {
            attributesManager,
            requestEnvelope
        } = handlerInput;
        let sessionAttributes = attributesManager.getSessionAttributes();

        // Log the request for debug purposes.
        console.log(`=====Request==${JSON.stringify(requestEnvelope)}`);
        console.log(`=========SessionAttributes==${JSON.stringify(sessionAttributes, null, 2)}`);
    }
};

module.exports = {
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler,
    ErrorHandler,
    RequestInterceptor
};