
import time
import logging
import json
import random
import threading
import math
from enum import Enum
from time import sleep

from agt import AlexaGadget

from ev3dev2.led import Leds
from ev3dev2.sound import Sound
from ev3dev2.motor import LargeMotor, OUTPUT_A, OUTPUT_B, OUTPUT_C, MoveTank, SpeedPercent, MediumMotor
from ev3dev2.sensor.lego import InfraredSensor, ColorSensor, TouchSensor

from ev3dev2.display import *

from PIL import Image

# Set the logging level to INFO to see messages from AlexaGadget
logging.basicConfig(level=logging.INFO)

class EventName(Enum):
    """
    The list of custom event name sent from this gadget
    """
    SETSPEED = "SetSpeed"
    SETTARGET = "SetTarget"
    FINDCOLOR = "FindColor"
    REMOTECONTROL = "RemoteControl"
    HOMEBUTTON = "HomeButton"


class MindstormsGadget(AlexaGadget):
    '''
    A Mindstorms gadget that can perform bi-directional interaction with an Alexa skill.
    '''

    def __init__(self):
        '''
        Performs Alexa Gadget initialization routines and ev3dev resource allocation.
        '''
        super().__init__()

        # Robot position and dimensions
        self.x = 0.0
        self.y = 0.0
        self.orientation = 0.0
        self.wheelRadius = 16.8 #milimiters
        self.distanceWheels = 100.0

        # Places defined in the field
        self.toPlaces = {
            'home': [1.0,1.0,0.0],
            'homeEntrance': [300.0, 1.0, 0.0],
            'parking': [800.0, 200.0, 3*math.pi/4],
            'trainstation': [980.0, 1.0, math.pi],
            'heliport': [450.0, 230.0, 3*math.pi/2],
            'port': [1.0, 490.0, 7*math.pi/4],
            'colorsLineStart': [100.0, 580.0, 0.0],
            'colorsLineEnd': [800.0, 580.0, math.pi]
        }

        # Positions of the different targets
        self.targets = {
            'plane': [1000.0,500.0],
            'boat': [-100.0, 500.0],
            'tree': [450.0, -100.0],
            'tractor': [1050.0, 200.0]
        }

        # Lego motors, leds, sound, sensors, display 
        self.drive = MoveTank(OUTPUT_B, OUTPUT_C)
        self.weapon = MediumMotor(OUTPUT_A)
        self.sound = Sound()
        self.leds = Leds()
        self.ir = InfraredSensor()
        self.ts = TouchSensor()
        self.lcd = Display()
        self.cs = ColorSensor()
        self.cs.mode = self.cs.MODE_COL_COLOR
        self.left_motor = LargeMotor(OUTPUT_B)
        self.right_motor = LargeMotor(OUTPUT_C)
        self.ir.on_channel1_top_left = self.remote_move(self.left_motor, 800)
        self.ir.on_channel1_bottom_left = self.remote_move(self.left_motor, -800)
        self.ir.on_channel1_top_right = self.remote_move(self.right_motor, 800)
        self.ir.on_channel1_bottom_right = self.remote_move(self.right_motor, -800)
        self.ir.on_channel2_top_left = self.remote_useTool()
        self.ir.on_channel2_top_right = self.remote_useTool()
        self.ir.on_channel4_beacon = self.beacon_activation()

        # Default values
        self.tool = 'gun'
        self.picker = 'pick'
        self.speed = 50
        self.color = ''
        self.detectedColor = 'none'
        self.beacon = False
        self.target = 'none'
        self.findColorOn = False
        self.ColorFound = False
        self.targetColor = ''
        self.fromPlace = 'home'
        self.toPlace = 'home'
        self.remoteDirection = 'forward'
        self.remoteControl = False

        self.show_image('Pinch left.bmp', 1)
        self.show_image('Pinch middle.bmp', 1)
        self.show_image('Pinch right.bmp', 1)
        self.show_image('Awake.bmp',0)
        self.sound.speak('Lego robot, ready for action')

        # Start threads for remote control, color sensor and touch sensor management
        threading.Thread(target=self._remote_control, daemon=True).start()
        threading.Thread(target=self._find_color, daemon=True).start()
        threading.Thread(target=self._touch_sensor, daemon=True).start()
        
    def on_connected(self, device_addr):
        '''
        Gadget connected to the paired Echo device.
        :param device_addr: the address of the device we connected to
        '''
        self.leds.set_color('LEFT', 'GREEN')
        self.leds.set_color('RIGHT', 'GREEN')
        print('{} connected to Echo device'.format(self.friendly_name))

    def on_disconnected(self, device_addr):
        '''
        Gadget disconnected from the paired Echo device.
        :param device_addr: the address of the device we disconnected from
        '''
        self.leds.set_color('LEFT', 'BLACK')
        self.leds.set_color('RIGHT', 'BLACK')
        print('{} disconnected from Echo device'.format(self.friendly_name))

    def on_custom_mindstorms_gadget_control(self, directive):
        '''
        Handles the Custom.Mindstorms.Gadget control directive.
        :param directive: the custom directive with the matching namespace and name
        '''
        try:
            payload = json.loads(directive.payload.decode('utf-8'))
            print('Control payload: {}'.format(payload))
            control_type = payload['type']
            
            self.ColorFound = False

            if control_type == 'changeTool':
                self.show_image('Medium motor.bmp', 1)
                self.show_image('Wink.bmp', 0)    
                self.tool = payload['tool']

            elif control_type == 'useTool':
                self.show_image('Boom.bmp', 1)                      
                self.tool = payload['tool']   
                self.useTool()

            elif control_type == 'notRightTool':
                self.show_image('Sick.bmp', 1)                      
                self.show_image('Question mark.bmp', 0)

            elif control_type == 'goSomewhere':
                self.show_image('Accept.bmp', 1)                      
                self.show_image('Lightning.bmp', 0) 
                self.toPlace = payload['place'] 
                self.speed = payload['speed'] 
                if self.toPlace == 'home':
                    self.goSomewhere('homeEntrance', self.speed)
                    self.goSomewhere(self.toPlace, self.speed)
                elif self.fromPlace == 'home':
                    self.goSomewhere('homeEntrance', self.speed)
                    self.goSomewhere(self.toPlace, self.speed)
                else:
                    self.goSomewhere(self.toPlace, self.speed)

            elif control_type == 'alreadyThere':
                self.show_image('Knocked out.bmp', 1)    

            elif control_type == 'findColor':
                self.show_image('Dizzy.bmp', 1)                      
                self.show_image('Color sensor.bmp', 0)     
                self.color = payload['color'] 
                self.speed = payload['speed'] 
                self.findColor(self.color, self.speed)            
                
            elif control_type == 'setSpeed':      
                self.speed = payload['speed']
                self.sound.play_file('./sounds/Blip.wav')
                if (self.speed == 100):
                    self.show_image('Dial 4.bmp', 0) 
                if (self.speed == 50):
                    self.show_image('Dial 2.bmp', 0)   
                if (self.speed == 20):
                    self.show_image('Dial 0.bmp', 0)
                # Send event from EV3 gadget to Alexa
                self._send_event(EventName.SETSPEED, {'speed': self.speed})

            elif control_type == 'setTarget':
                self.sound.play_file('./sounds/Blip.wav')
                self.show_image('Target.bmp', 0)   
                self.target = payload['target']
                print("target = {}".format(self.target))
                # Send event from EV3 gadget to Alexa
                self._send_event(EventName.SETTARGET, {'target': self.target})
            
            elif control_type == 'moveRemote':
                self.remoteControl = True
                self.show_image('EV3 icon.bmp', 0)   
                self.remoteDirection = payload['direction']
                if self.remoteDirection == 'forward':
                    self.move(100)
                elif self.remoteDirection == 'backward':
                    self.speed = 0 - self.speed
                    self.move(100)
                    self.speed = 0 - self.speed
                elif self.remoteDirection == 'left':
                    self.turn(math.pi/2)
                elif self.remoteDirection == 'right':
                    self.turn(-math.pi/2)
                # Send event from EV3 gadget to Alexa
                self._send_event(EventName.SETTARGET, {'target': self.target})

            elif control_type == 'noPositionKnown':
                self.show_image('Touch sensor.bmp', 0)

            elif control_type == 'alexaTalk':
                self.show_image('Dizzy.bmp', 0)
            else:
                self.show_image('Question mark.bmp', 0)

        except KeyError:
            print('Missing expected parameters: {}'.format(directive))

    def goSomewhere(self, toPlace, speed):
        
        coordinates = self.toPlaces[toPlace]

        finalX = coordinates[0]
        finalY = coordinates[1]
        finalOrientation = coordinates[2]
        journeyX = finalX - self.x
        journeyY = finalY - self.y

        #distance between initial and final point
        journeyDistance = math.hypot(journeyX,journeyY)

        #direction to get there
        journeyDirection = self.calculateJourneyDirection(journeyX, journeyY)
        turnJourneyDirection = journeyDirection - self.orientation 

        # If robot coming back to home position we move backwards from homeEntrance
        if ((self.fromPlace == 'homeEntrance') and (self.toPlace == 'home')):
            self.moveBackwards(journeyDistance)
        else:
            # Robot turns to face direction, moves the distance and turns when in destination
            self.turn(turnJourneyDirection)
            self.move(journeyDistance)
            turnFinalOrientation = finalOrientation - journeyDirection        
            self.turn(turnFinalOrientation)

        # Record the final position and orientation
        self.setPosition(finalX, finalY, finalOrientation)
        self.fromPlace = toPlace

    def calculateJourneyDirection(self, journeyX, journeyY):
        direction = math.atan(journeyY/journeyX)
        if journeyX < 0:
            direction += math.pi
        if direction < 0: 
            direction += 2*math.pi             
        return direction

    def turn(self, angle):
        if angle > math.pi:
            angle = angle - 2*math.pi
        elif angle < -math.pi:
            angle = angle + 2*math.pi
        degrees = (360 * self.distanceWheels * angle) / (2 * math.pi * self.wheelRadius)
        if self.ColorFound == False:
            self.drive.on_for_degrees(SpeedPercent(self.speed), SpeedPercent(-self.speed), degrees, block=True)

    def move(self, distance):
        degrees = (360 * distance) / (2 * math.pi * self.wheelRadius)
        self.drive.on_for_degrees(SpeedPercent(self.speed), SpeedPercent(self.speed), degrees, block=True)

    def moveBackwards(self, distance):
        degrees = (360 * distance) / (2 * math.pi * self.wheelRadius)
        self.drive.on_for_degrees(SpeedPercent(-self.speed), SpeedPercent(-self.speed), degrees, block=True)

    def setPosition(self, newX, newY, newOrientation):
            if newOrientation < 0:
                newOrientation += 2 * math.pi
            elif newOrientation >= 2 * math.pi:
                newOrientation -= 2 * math.pi
            self.x = float(newX)
            self.y = float(newY)
            self.orientation = float(newOrientation)

    def findColor(self, color, speed):
        #Move to the colorsLine position to start scan colors. If the initial position is home move to homeEntrance first
        self.toPlace = 'colorsLineStart'
        if self.fromPlace == 'home':
            self.goSomewhere('homeEntrance', self.speed)
        self.goSomewhere(self.toPlace, speed)
        
        self.targetColor = color
        self.findColorOn = True

        time.sleep(2)
        if self.findColorOn == True:
            self.toPlace = 'colorsLineEnd'
            self.goSomewhere(self.toPlace, 30)
            
            # Send event from EV3 gadget to Alexa
            if self.ColorFound == False:
                self._send_event(EventName.FINDCOLOR, {'color': "none"})
     
    def useTool(self):
        # Robot turns to face the target and depending on the weapon it has it moves closer to the specified target
        self.faceTarget()
        self.sound.play_file('./sounds/Laser.wav')
        if (self.tool == 'gun'):
            self.weapon.on_for_degrees(SpeedPercent(100), 1000)

        elif (self.tool == 'hammer'):
            self.weapon.on_for_degrees(SpeedPercent(100), 200)
            self.weapon.on_for_degrees(SpeedPercent(-50), 200)

        elif (self.tool == 'picker'):
            # Checking if the picker is open to close it and the pother way around
            if (self.picker == 'pick'):
                self.weapon.on_for_degrees(SpeedPercent(100), 90)
                self.picker = 'leave'

            elif (self.picker == 'leave'):
                self.weapon.on_for_degrees(SpeedPercent(-100), 90)
                self.picker = 'pick'

        elif (self.tool == 'blade'):
            self.weapon.on_for_degrees(SpeedPercent(100), 360)
            self.weapon.on_for_degrees(SpeedPercent(-100), 360)

    def faceTarget(self):
        if ((self.target != 'none') and (self.remoteControl == False)):
            # Robot turns to face the target and move depending on the tool
            print("entra")
            coordinates = self.targets[self.target]
            targetX = coordinates[0]
            targetY = coordinates[1]   
            directionX = targetX - self.x
            directionY = targetY - self.y
            
            # Turning to direction to face the target
            direction = self.calculateJourneyDirection(directionX, directionY)
            turnDirection = direction - self.orientation     
            self.turn(turnDirection)  

            # Calculate the distance to move with an offset depending on the weapon the robot has
            distance = math.hypot(directionX,directionY)            
            if (self.tool == 'gun'):
                offset = distance
            if (self.tool == 'hammer'):
                offset = 130
            if (self.tool == 'blade'):
                offset = 80
            if (self.tool == 'picker'):
                offset = 80
            self.move(distance-offset)

            # Record the final position and orientation
            finalX = targetX - offset* math.cos(direction)
            finalY = targetY - offset * math.sin(direction)
            self.setPosition(finalX, finalY, direction)

        elif (self.target == 'mobile'):
            # Send event from EV3 gadget to Alexa as we will not track the position of the robot
            self._send_event(EventName.REMOTECONTROL, {})
            self.remoteControl = True

            heading = self.ir.heading(4)
            turnDirection = math.radians(heading) + math.pi # We add pi because the IR is pointing backwards
            infraredDistance = 7 # 700 milimeters / 100 (max percentage value ir distance)
            distance = infraredDistance * self.ir.distance(4)
            self.turn(turnDirection)

            if (self.tool == 'gun'):
                offset = distance
            if (self.tool == 'hammer'):
                offset = 130
            if (self.tool == 'blade'):
                offset = 80
            if (self.tool == 'picker'):
                offset = 80
            self.move(distance-offset)

            # We cannot ensure that infraredDistance is 70cm max so we do not trust the calculus of the position
            # finalX = self.x - (distance-offset) * math.cos(direction)
            # finalY = self.y - (distance-offset) * math.sin(direction)
            # self.setPosition(finalX, finalY, direction)

    def show_image(self, image_name, time):
        image_path = './images/'+ image_name
        image = Image.open(image_path)
        self.lcd.image.paste(image, (0,0))
        self.lcd.update()
        sleep(time) 

    def _send_event(self, name: EventName, payload):
        '''
        Sends a custom event to trigger a sentry action.
        :param name: the name of the custom event
        :param payload: the sentry JSON payload
        '''
        self.send_custom_event('Custom.Mindstorms.Gadget', name.value, payload)

    def remote_move(self, motor, speed):
        # Depending on the button pressed the motor connected to it will run while button is pressed
        def on_press(state):
            print('remote move. state = {}'.format(state))
            if (self.remoteControl == False):
                # Send event from EV3 gadget to Alexa
                self._send_event(EventName.REMOTECONTROL, {})
                self.remoteControl = True
            if state:
                motor.run_forever(speed_sp=speed)
            else:
                motor.stop()
        return on_press

    def remote_useTool(self):
        # We trigger the weapon if the button in the indicated channel is pressed
        def on_press(state):
            if (self.remoteControl == False):
                # Send event from EV3 gadget to Alexa
                self._send_event(EventName.REMOTECONTROL, {})
                self.remoteControl = True

            self.sound.play_file('./sounds/Horn.wav')

            if (self.tool == 'gun'):
                self.weapon.on_for_degrees(SpeedPercent(100), 1000)

            elif (self.tool == 'hammer'):
                self.weapon.on_for_degrees(SpeedPercent(100), 200)
                self.weapon.on_for_degrees(SpeedPercent(-50), 200)

            elif (self.tool == 'picker'):
                if (self.picker == 'pick'):
                    self.weapon.on_for_degrees(SpeedPercent(100), 90)
                    self.picker = 'leave'
                elif (self.picker == 'leave'):
                    self.weapon.on_for_degrees(SpeedPercent(-100), 90)
                    self.picker = 'pick'

            elif (self.tool == 'blade'):
                self.weapon.on_for_degrees(SpeedPercent(100), 360)
                self.weapon.on_for_degrees(SpeedPercent(-100), 360)

        return on_press

    def beacon_activation(self):
        print("beacon activated: {}".format(self.ir.beacon(channel=4)))
        if (self.ir.beacon(4) == True):
            self.beacon = True
        elif (self.ir.beacon(4) == False):
            self.beacon = False

    def _remote_control(self):
        # This thread checks if the Infra ted remote control is being used and process the pressing button event
        time.sleep(3)
        while True:
            self.ir.process()
            time.sleep(0.1)
    
    def _touch_sensor(self):
        # This thread checks if the touch sensor is pressed and once is pressed it changes the robot position to home
        while True:
            self.ts.wait_for_pressed()     
            if (self.remoteControl == True):
                self.sound.beep()
                self.setPosition(1.0, 1.0, 0.0)
                self.toPlace = 'home'
                self.fromPlace = 'home'
                # Send event from EV3 gadget to Alexa
                self._send_event(EventName.HOMEBUTTON, {'place': "home"})    
                self.remoteControl = False
            time.sleep(1)

    def _find_color(self):
        # This thread checks if the finding color directive is on and then it goes to the color line and search the indicated color
        while True:
            time.sleep(0.3)
            while self.findColorOn:
                targetColor= self.targetColor
                detectedColor = self.cs.color_name # 0: No color, 1: Black, 2: Blue, 3: Green, 4: Yellow, 5: Red, 6: White, 7: Brown
                if (targetColor == detectedColor):
                    # If the target color is detected robot sends an event to Alexa and stops
                    self.drive.off()
                    self.ColorFound = True
                    self.findColorOn = False
                    self._send_event(EventName.FINDCOLOR, {'color': detectedColor})
                    self.sound.play_file('./sounds/Horn.wav')
                    self.sound.speak('That color is here')
                    self.remoteControl = True
                    time.sleep(0.3)

if __name__ == '__main__':
    # Startup sequence
    gadget = MindstormsGadget()
    gadget.sound.play_song((('C4', 'e'), ('D4', 'e'), ('E5', 'q')))
    gadget.leds.set_color('LEFT', 'GREEN')
    gadget.leds.set_color('RIGHT', 'GREEN')

    # Gadget main entry point
    gadget.main()

    # Shutdown sequence
    gadget.sound.play_song((('E5', 'e'), ('C4', 'e')))
    gadget.leds.set_color('LEFT', 'BLACK')
    gadget.leds.set_color('RIGHT', 'BLACK')