/*
 * This is the Lambda function that represents the endpoint of the Alexa Lego Mindstorms challenge skill.
 * The code can be copied and used without restriction.
 * This skill send directives and receive events from the Lego Mindstorm Brick Echo connected gadget.
 * The code may contain parts copied from Alexa Lego Mindstorms mission 4.
 */

const Alexa = require('ask-sdk-core')
const Resources = require('./resources')
const Common = require('./common')
const Arrows = require('./documents/arrows.json')
const Sequence = require('./documents/sequence.json')

// The namespace of the custom directive to be sent by this skill
const NAMESPACE = 'Custom.Mindstorms.Gadget';

// The name of the custom directive to be sent this skill
const NAME_CONTROL = 'control';

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle: async function (handlerInput) {
        console.log("*************** LAUNCH Received ***************");
        console.log(handlerInput.requestEnvelope);

        const request = handlerInput.requestEnvelope;
        const {
            apiEndpoint,
            apiAccessToken
        } = request.context.System;
        const apiResponse = await Resources.getConnectedEndpoints(apiEndpoint, apiAccessToken);
        console.log('apiResponse: ', apiResponse);
        let endpointId = [];

        const response = handlerInput.responseBuilder;

        //We are going to assume that the robot always start with the Gun as a weapon
        Resources.putSessionAttribute(handlerInput, 'initialTool', 'gun');
        Resources.putSessionAttribute(handlerInput, 'finalTool', 'gun');

        if ((apiResponse.endpoints || []).length === 0) {
            const data = Resources.calculateSequenceDatasource(handlerInput, "NoGadget");
            const datasource = data.datasource;
            const commands = data.commands;
            const speechOutput = data.speechOutput;
            const repromptOutput = speechOutput;
            const directive = data.directive;


            // If the Echo device has Screen and APL is supported
            if (Resources.supportsAPL(handlerInput)) {
                return response
                    .addDirective({
                        type: "Alexa.Presentation.APL.RenderDocument",
                        token: "sequence",
                        document: Sequence,
                        datasources: datasource
                    })
                    .addDirective({
                        type: "Alexa.Presentation.APL.ExecuteCommands",
                        token: "sequence",
                        commands: commands
                    })
                    .getResponse();
            }
            // If the Echo device has not Screen, only speak
            return response
                .speak(speechOutput)
                .reprompt(repromptOutput)
                .getResponse();

        }

        // Store the gadget endpointId to be used in this skill session
        endpointId = apiResponse.endpoints[0].endpointId || [];
        Resources.putSessionAttribute(handlerInput, 'endpointId', endpointId);

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Resources.putSessionAttribute(handlerInput, 'token', token);

        const data = Resources.calculateSequenceDatasource(handlerInput, "LaunchRequest");
        const datasource = data.datasource;
        const commands = data.commands;
        const speechOutput = data.speechOutput;
        const repromptOutput = speechOutput;
        const directive = data.directive;

        // If the Echo device has Screen and APL is supported
        if (Resources.supportsAPL(handlerInput)) {
            return response
                .addDirective({
                    type: "Alexa.Presentation.APL.RenderDocument",
                    token: "sequence",
                    document: Sequence,
                    datasources: datasource
                })
                .addDirective({
                    type: "Alexa.Presentation.APL.ExecuteCommands",
                    token: "sequence",
                    commands: commands
                })
                .addDirective(directive)
                .addDirective(Resources.buildStartEventHandler(token, 60000, {}))
                .getResponse();
        }
        // If the Echo device has not Screen, only speak
        return response
            .speak(speechOutput)
            .reprompt(repromptOutput)
            .addDirective(directive)
            .addDirective(Resources.buildStartEventHandler(token, 60000, {}))
            .getResponse();
    }

};


const ChangeToolHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'changeTool';
    },
    handle: function (handlerInput) {
        console.log("*************** CHANGE TOOL Received ***************");
        console.log(handlerInput.requestEnvelope);

        const attributesManager = handlerInput.attributesManager;
        const initialTool = attributesManager.getSessionAttributes().finalTool;

        const finalTool = Resources.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'finalTool');

        Resources.putSessionAttribute(handlerInput, 'initialTool', initialTool);
        Resources.putSessionAttribute(handlerInput, 'finalTool', finalTool);

        const data = Resources.calculateSequenceDatasource(handlerInput, "ChangeTool");
        const datasource = data.datasource;
        const commands = data.commands;
        const speechOutput = data.speechOutput;
        const repromptOutput = speechOutput;
        const directive = data.directive;

        const response = handlerInput.responseBuilder;

        // If the Echo device has Screen and APL is supported
        if (Resources.supportsAPL(handlerInput)) {
            return response
                .addDirective({
                    type: "Alexa.Presentation.APL.RenderDocument",
                    token: "sequence",
                    document: Sequence,
                    datasources: datasource
                })
                .addDirective({
                    type: "Alexa.Presentation.APL.ExecuteCommands",
                    token: "sequence",
                    commands: commands
                })
                .addDirective(directive)
                .getResponse();
        }
        // If the Echo device has not Screen, only speak
        return response
            .speak(speechOutput)
            .reprompt(repromptOutput)
            .addDirective(directive)
            .getResponse();
    }
};

const UseToolHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'useTool';
    },
    handle: function (handlerInput) {
        console.log("*************** USE TOOL Received ***************");
        console.log(handlerInput.requestEnvelope);
        const attributesManager = handlerInput.attributesManager;
        const action = Resources.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'actionUse');
        const tool = Resources.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'toolUse');
        const finalTool = attributesManager.getSessionAttributes().finalTool;
        if (!tool) {
            tool = finalTool;
        }

        const connections = {
            "leave": "picker",
            "pick": "picker",
            "shoot": "gun",
            "smash": "hammer",
            "pick": "picker"
        }
        let data;
        if ((finalTool === tool) && (tool === connections[action] || action === "use")) {
            //the action is the correct one and then we have to execute it
            data = Resources.calculateSequenceDatasource(handlerInput, "UseTool");
            Resources.putSessionAttribute(handlerInput, 'action', action);
        } else {
            //it is not the right action for the tool we have
            data = Resources.calculateSequenceDatasource(handlerInput, "NotRightTool");
        }
        const datasource = data.datasource;
        const commands = data.commands;
        const speechOutput = data.speechOutput;
        const repromptOutput = speechOutput;
        const directive = data.directive;

        const response = handlerInput.responseBuilder;

        // If the Echo device has Screen and APL is supported
        if (Resources.supportsAPL(handlerInput)) {

            return response
                .addDirective({
                    type: "Alexa.Presentation.APL.RenderDocument",
                    token: "sequence",
                    document: Sequence,
                    datasources: datasource
                })
                .addDirective({
                    type: "Alexa.Presentation.APL.ExecuteCommands",
                    token: "sequence",
                    commands: commands
                })
                .addDirective(directive)
                .getResponse();
        }
        // If the Echo device has not Screen, only speak
        return response
            .speak(speechOutput)
            .reprompt(repromptOutput)
            .addDirective(directive)
            .getResponse();

    }
};

const GoSomewhereHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'goSomewhere';
    },
    handle: function (handlerInput) {
        console.log("*************** GO SOMEWHERE Received ***************");
        console.log(handlerInput.requestEnvelope);

        const attributesManager = handlerInput.attributesManager;
        const placeToGo = Resources.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'placeToGo');
        const place = attributesManager.getSessionAttributes().place;

        const remote = attributesManager.getSessionAttributes().remote;
        let data;
        if (remote) {
            if (place == "ColorLineSomewhere") {
                data = Resources.calculateSequenceDatasource(handlerInput, "NoPositionKnownColor");
            } else {
                data = Resources.calculateSequenceDatasource(handlerInput, "NoPositionKnown");
            }
        } else {
            if (placeToGo === place) {
                //Robot is there already
                data = Resources.calculateSequenceDatasource(handlerInput, "AlreadyThere");
            } else {
                //Robot goes there
                Resources.putSessionAttribute(handlerInput, 'place', placeToGo);
                data = Resources.calculateSequenceDatasource(handlerInput, "GoSomewhere");
            }
        }

        const datasource = data.datasource;
        const commands = data.commands;
        const speechOutput = data.speechOutput;
        const repromptOutput = speechOutput;
        const directive = data.directive;

        const response = handlerInput.responseBuilder;

        // If the Echo device has Screen and APL is supported
        if (Resources.supportsAPL(handlerInput)) {

            return response
                .addDirective({
                    type: "Alexa.Presentation.APL.RenderDocument",
                    token: "sequence",
                    document: Sequence,
                    datasources: datasource
                })
                .addDirective({
                    type: "Alexa.Presentation.APL.ExecuteCommands",
                    token: "sequence",
                    commands: commands
                })
                .addDirective(directive)
                .getResponse();
        }
        // If the Echo device has not Screen, only speak
        return response
            .speak(speechOutput)
            .reprompt(repromptOutput)
            .addDirective(directive)
            .getResponse();
    }
};

const FindColorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'findColor';
    },
    handle: function (handlerInput) {
        console.log("*************** FIND COLOR Received ***************");
        console.log(handlerInput.requestEnvelope);

        const attributesManager = handlerInput.attributesManager;
        const color = Resources.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'colorFind');
        Resources.putSessionAttribute(handlerInput, 'color', color);

        const remote = attributesManager.getSessionAttributes().remote;
        let data;
        if (remote) {
            data = Resources.calculateSequenceDatasource(handlerInput, "NoPositionKnown");
        } else {
            data = Resources.calculateSequenceDatasource(handlerInput, "FindColor");
        }

        const datasource = data.datasource;
        const commands = data.commands;
        const speechOutput = data.speechOutput;
        const repromptOutput = speechOutput;
        const directive = data.directive;

        const response = handlerInput.responseBuilder;

        // If the Echo device has Screen and APL is supported
        if (Resources.supportsAPL(handlerInput)) {

            return response
                .addDirective({
                    type: "Alexa.Presentation.APL.RenderDocument",
                    token: "sequence",
                    document: Sequence,
                    datasources: datasource
                })
                .addDirective({
                    type: "Alexa.Presentation.APL.ExecuteCommands",
                    token: "sequence",
                    commands: commands
                })
                .addDirective(directive)
                .getResponse();
        }
        // If the Echo device has not Screen, only speak
        return response
            .speak(speechOutput)
            .reprompt(repromptOutput)
            .addDirective(directive)
            .getResponse();
    }
};

const SetSpeedHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'setSpeed';
    },
    handle: function (handlerInput) {
        console.log("*************** SET SPEED Received ***************");
        console.log(handlerInput.requestEnvelope);

        const speed = Resources.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'speed');
        Resources.putSessionAttribute(handlerInput, 'speed', speed);

        const data = Resources.calculateSequenceDatasource(handlerInput, "SetSpeed");

        const datasource = data.datasource;
        const commands = data.commands;
        const speechOutput = data.speechOutput;
        const repromptOutput = speechOutput;
        const directive = data.directive;

        const response = handlerInput.responseBuilder;

        // If the Echo device has Screen and APL is supported
        if (Resources.supportsAPL(handlerInput)) {

            return response
                .addDirective({
                    type: "Alexa.Presentation.APL.RenderDocument",
                    token: "sequence",
                    document: Sequence,
                    datasources: datasource
                })
                .addDirective({
                    type: "Alexa.Presentation.APL.ExecuteCommands",
                    token: "sequence",
                    commands: commands
                })
                .addDirective(directive)
                .getResponse();
        }
        // If the Echo device has not Screen, only speak
        return response
            .speak(speechOutput)
            .reprompt(repromptOutput)
            .addDirective(directive)
            .getResponse();
    }
};

const SetTargetHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'setTarget';
    },
    handle: function (handlerInput) {
        console.log("*************** SET TARGET Received ***************");
        console.log(handlerInput.requestEnvelope);

        const target = Resources.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'target');
        Resources.putSessionAttribute(handlerInput, 'target', target);

        const data = Resources.calculateSequenceDatasource(handlerInput, "SetTarget");

        const datasource = data.datasource;
        const commands = data.commands;
        const speechOutput = data.speechOutput;
        const repromptOutput = speechOutput;
        const directive = data.directive;

        const response = handlerInput.responseBuilder;

        // If the Echo device has Screen and APL is supported
        if (Resources.supportsAPL(handlerInput)) {

            return response
                .addDirective({
                    type: "Alexa.Presentation.APL.RenderDocument",
                    token: "sequence",
                    document: Sequence,
                    datasources: datasource
                })
                .addDirective({
                    type: "Alexa.Presentation.APL.ExecuteCommands",
                    token: "sequence",
                    commands: commands
                })
                .addDirective(directive)
                .getResponse();
        }
        // If the Echo device has not Screen, only speak
        return response
            .speak(speechOutput)
            .reprompt(repromptOutput)
            .addDirective(directive)
            .getResponse();
    }
};

const RemoteControlHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'remoteControl';
    },
    handle: function (handlerInput) {
        console.log("*************** REMOTE CONTROL Diplay Received ***************");
        console.log(handlerInput.requestEnvelope);

        Resources.putSessionAttribute(handlerInput, 'remote', true);

        const data = Resources.getRemoteControl(handlerInput);

        const datasource = data.datasource;
        const speechOutput = data.speechOutput;
        const repromptOutput = speechOutput;

        const response = handlerInput.responseBuilder;

        // If the Echo device has Screen and APL is supported
        if (Resources.supportsAPL(handlerInput)) {

            return response
                .speak(speechOutput)
                .addDirective({
                    type: "Alexa.Presentation.APL.RenderDocument",
                    token: "remoteControl",
                    document: Arrows,
                    datasources: datasource
                })
                .getResponse();
        }
        // If the Echo device has not Screen, only speak

        return response
            .speak(speechOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const TouchEventHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'Alexa.Presentation.APL.UserEvent';
    },
    handle(handlerInput) {
        const data = Resources.getClicked(handlerInput);

        const speechOutput = data.speechOutput;
        const directive = data.directive;

        const response = handlerInput.responseBuilder;

        return response
            .addDirective(directive)
            .speak(speechOutput)
            .getResponse();

    }
};


const EventsReceivedRequestHandler = {
    // Checks for a valid token and endpoint.
    canHandle(handlerInput) {

        let {
            request
        } = handlerInput.requestEnvelope;
        console.log('Request type: ' + Alexa.getRequestType(handlerInput.requestEnvelope));
        if (request.type !== 'CustomInterfaceController.EventsReceived') return false;

        const attributesManager = handlerInput.attributesManager;
        let sessionAttributes = attributesManager.getSessionAttributes();
        let customEvent = request.events[0];

        // Validate event token
        if (sessionAttributes.token !== request.token) {
            console.log("Event token doesn't match. Ignoring this event");
            return false;
        }

        // Validate endpoint
        let requestEndpoint = customEvent.endpoint.endpointId;
        if (requestEndpoint !== sessionAttributes.endpointId) {
            console.log("Event endpoint id doesn't match. Ignoring this event");
            return false;
        }
        return true;
    },
    handle(handlerInput) {
        console.log("*************** EVENT Received ***************");
        console.log(handlerInput.requestEnvelope);

        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        const customEvent = handlerInput.requestEnvelope.request.events[0];
        const payload = customEvent.payload;
        const name = customEvent.header.name;

        const color = sessionAttributes.color || '';
        const target = sessionAttributes.target || '';
        const place = sessionAttributes.place || '';
        const tool = sessionAttributes.tool || '';

        //        if ((name === 'UseTool') || (name === 'FindColor') || ((name === 'GoSomewhere') && ((payload.place != 'homeEntrance') || (payload.place != 'colorsLineStart') || (payload.place != 'colorsLineEnd')))) {
        if ((name === 'FindColor') || (name === 'HomeButton')) {
            console.log("*************** FIND COLOR / HOMEBUTTON ***************");
            let value = name + "Event";

            if (name == 'FindColor') {
                if (payload.color == 'none') {
                    Resources.putSessionAttribute(handlerInput, 'place', 'ColorLineEnd');
                    value = "No" + value;
                } else {
                    Resources.putSessionAttribute(handlerInput, 'place', 'ColorLineSomewhere');
                    Resources.putSessionAttribute(handlerInput, 'remote', true);
                }
            }
            if ((name == 'HomeButton')) {
                Resources.putSessionAttribute(handlerInput, 'place', payload.place);
                Resources.putSessionAttribute(handlerInput, 'remote', false);
            }
            const data = Resources.calculateSequenceDatasource(handlerInput, value);
            const datasource = data.datasource;
            const commands = data.commands;
            const speechOutput = data.speechOutput;
            const repromptOutput = speechOutput;
            const directive = data.directive;

            const response = handlerInput.responseBuilder;

            // If the Echo device has Screen and APL is supported
            if (Resources.supportsAPL(handlerInput)) {

                return response
                    .addDirective({
                        type: "Alexa.Presentation.APL.RenderDocument",
                        token: "sequence",
                        document: Sequence,
                        datasources: datasource
                    })
                    .addDirective({
                        type: "Alexa.Presentation.APL.ExecuteCommands",
                        token: "sequence",
                        commands: commands
                    })
                    .getResponse();
            }
            // If the Echo device has not Screen, only speak
            return response
                .speak(speechOutput)
                .reprompt(repromptOutput)
                .addDirective(directive)
                .getResponse();

        } else if (name === 'RemoteControl') {
            Resources.putSessionAttribute(handlerInput, 'remote', true);
            const response = handlerInput.responseBuilder;
            return response
                .getResponse();
        } else {
            //What if there is any other event received: Do nothing
            const response = handlerInput.responseBuilder;
            return response
                .getResponse();
        }

    }
};

const ExpiredRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'CustomInterfaceController.Expired'
    },
    handle(handlerInput) {
        console.log("== Custom Event Expiration Input ==");

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Resources.putSessionAttribute(handlerInput, 'token', token);

        // Extends skill session
        return handlerInput.responseBuilder
            .addDirective(Resources.buildStartEventHandler(token, 60000, {}))
            .getResponse();

    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,

        ChangeToolHandler,
        UseToolHandler,
        GoSomewhereHandler,
        FindColorHandler,

        SetSpeedHandler,
        SetTargetHandler,
        RemoteControlHandler,

        TouchEventHandler,
        EventsReceivedRequestHandler,
        ExpiredRequestHandler,

        Common.HelpIntentHandler,
        Common.CancelAndStopIntentHandler,
        Common.SessionEndedRequestHandler,
        Common.IntentReflectorHandler
    )
    .addRequestInterceptors(Common.RequestInterceptor)
    .addErrorHandlers(
        Common.ErrorHandler,
    )
    .lambda();