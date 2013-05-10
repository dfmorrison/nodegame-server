/**
 * # PlayerServer
 * 
 * Copyright(c) 2012 Stefano Balietti
 * MIT Licensed
 * 
 * GameServer for the players endpoint.
 * 
 * Inherits from `GameServer` and attaches special listeners.
 * 
 * PlayerServer passes the id of the sender when forwarding msgs
 * 
 * ---
 * 
 * Technical notes:
 * 
 * Forward must be done always after a SEND, because it can modifies the .to
 * and .forward properties of the message.
 * 
 * 
 */

// # Global scope

module.exports = PlayerServer;

var GameServer 		= require('./../GameServer'),
	GameMsgManager 	= require('./../GameMsgManager');

var node = require('nodegame-client');

var PlayerList	= node.PlayerList,
	Player 		= node.Player;

var action = node.action;

PlayerServer.prototype.__proto__ = GameServer.prototype;
PlayerServer.prototype.constructor = PlayerServer;

/**
 * ## PlayerServer constructor
 *
 * Creates a new instance of PlayerServer
 * 
 * @param {object} options A configuration object 
 */
function PlayerServer(options) {
	GameServer.call(this, options);
	
	this.notify = {} || this.user_options.notifyPlayers;
	this.forwardAll = ('undefined' === typeof this.user_options.forwardAllMessages) 
							? true : this.user_options.forwardAllMessages;
	
}

// ## PlayerServer methods

/**
 * ### PlayerServer.attachCustomListeners
 * 
 * Implements the abstract method from `GameServer` with listeners
 * specific to the players endpoint
 * 
 */
PlayerServer.prototype.attachCustomListeners = function() {
	var that = this,
		sys = this.sysLogger,
		say = action.SAY + '.',
		set = action.SET + '.',	
		get = action.GET + '.';

// ## LISTENERS	
	
// ### say.HI 
// Listens on newly connected players	
    this.on(say + 'HI', function(msg) {
    	
		sys.log('Incoming player: ' + msg.from);
    	
		
		if (that.notify.onConnect) {
	    	// Notify other players that a new one connected
			that.pl.each(function(p) {
				that.msg.sendPCONNECT(msg.data, p.id); // or sid?
			});
		}
		
		// Add the player to to the list
		that.pl.add(msg.data);
    	
		if (that.notify.onConnect) {
			// Send the list of connected players to new player
			that.msg.sendPLIST(that, msg.from);			
		}
		
		// Send the list of connected players to the monitors
		that.msg.forwardPCONNECT(msg.data);
		
	});

// ### say.HI_AGAIN    
// Listens on reconnecting players    
    this.on(say + 'HI_AGAIN', function(msg) {
    	
		sys.log('Returning PLAYER: ' + msg.from);
		var player = that.disconnected.pop(msg.data.id);
				
		if (player) {
			
			// Update the socket id with the old id
			that.socket.id = player.id;

			if (that.notify.onConnect) {
		    	// Notify other players that a new one connected
				that.pl.each(function(p) {
					that.msg.sendPCONNECT(msg.data, p.id); // or sid?
				});
			}
			
			// Add the player to to the list
			that.pl.add(msg.data);
	    	
			if (that.notify.ononStageUpdateUpdate) {
				// Send the list of connected players to new player
				that.msg.sendPLIST(that, msg.from);			
			}
			
			// Send the list of connected players to the monitors
			that.msg.forwardPCONNECT(msg.data); 
	    	
		}
		else {
			sys.log('Received HI_AGAIN message, but player was not in the disconnected list: ' + msg.from);
		}
		
	});

// ### say.TXT    
// Listens on say.TXT messages	
    this.on(say + 'TXT', function(msg) {
		that.processMessage(msg);
	});

// ### say.DATA    
// Listens on say.DATA messages			
    this.on(say + 'DATA', function(msg) {
    	that.processMessage(msg);
	});

// ### set.DATA    
// Listens on set.DATA messages
    this.on(set + 'DATA', function(msg) {

		// Creates a copy of monitors' memory object here
		// if a local memory object is present			
		if (that.partner.memory) {
			that.partner.memory.add(msg.text, msg.data, msg.from);
		}
		that.msg.forward (msg);
	
	});	
	
//// ### say.STATE 
//// Listens on say.STATE messages   
//    this.on(say + 'STATE', function(msg) {
//		
//		if (that.pl.exist(msg.from)){
//			// <!-- Do we need this? --!>
//			that.pl.updatePlayerState(msg.from, msg.data);
//
//			// TODO: if it is not send, the observer does not get informed
//			// about change of state.
//			// but a client get back its own msg too
//			
//			if (that.notify.onStageUpdate) {
//				that.msg.send(msg);
//			}
//			
//			// Should be:
//			//that.msg.broadcast(msg)
//			
//			// This may break things
//			that.msg.forward(msg);
//		}
//	});	
    

// ### say.STAGE 
// Listens on say.STAGE messages   
    this.on(say + 'STAGE', function(msg) {
	
    	if (that.pl.exist(msg.from)){
			// <!-- Do we need this? --!>
			that.pl.updatePlayerStage(msg.from, msg.data);
	
			// TODO: if it is not send, the observer does not get informed
			// about change of stage.
			// but a client get back its own msg too
			
			if (that.notify.onStageUpdate) {
				that.msg.send(msg);
			}
			
			// Should be:
			//that.msg.broadcast(msg)
			
			// This may break things
			that.msg.forward(msg);
    	}
    });	    
    
// ### get.DATA    
// Listener on get (Experimental)
    this.on(get + 'DATA', function (msg) {

    	//console.log(this.pl);
		//console.log('HERE P!!!');
		// Ask a random player to send the game;
		// var p = this.pl.getRandom();
		// that.msg.sendDATA('get', 'ABC', msg.from, msg.txt);

	});

// ### closed    
// Listens on players disconnecting   
    this.on('disconnect', function (player) {
      	sys.log(that.name + ' Disconnected: ' + player.id);
    	
      	if (that.notify.onConnect) {
      		that.msg.sendPDISCONNECT(player);
      	}
 
    	that.msg.forwardPDISCONNECT(player);
    });

// ### shutdown    
// Listens on server shutdown
	this.sio.sockets.on("shutdown", function(message) {
		sys.log("Server is shutting down.");
		that.pl.clear(true);
		if (that.notify.onConnect) {
			that.msg.sendPLIST(that);
		}
		that.msg.forwardPLIST(that);
	});
};

PlayerServer.prototype.processMessage = function (msg) {
	if (this.isValidRecipient(msg.to)) {
		if (msg.to !== 'SERVER') {
			this.msg.send(msg);
		}

		if (this.forwardAll) {
			this.msg.forward(msg);
		}
	}
};