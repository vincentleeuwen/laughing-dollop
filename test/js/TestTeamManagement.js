var RushKick = artifacts.require("RushKick");
import expectThrow from './helpers/expectThrow';
import increaseTimeTo from './helpers/increaseTime';

contract('RushKick TeamManagement', function(accounts) {

  const entryFee = 102986611700000000;
  const updateFee = entryFee / 10;

  if("Should reject second team submission by same owner", function() {
    const accountOne = accounts[0];
    return RushKick.deployed().then(async function(instance) {
      await expectThrow(instance.addTeam(0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a7,
        {from: accountOne, value: entryFee}));
    });
  });

  it("Should send out a TeamCreate event", function() {
    const accountTwo = accounts[1];
    return RushKick.deployed().then(function(instance) {
      return instance.addTeam(0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a7,
        {from: accountTwo, value: entryFee});
    }).then( function(result) {
      assert.equal(result.logs[0].event, "TeamCreate", "TeamCreate event not emitted");
    });
  });

  it("Should add team and return the correct variables", function() {
    const accountOne = accounts[0];
    return RushKick.deployed().then(function(instance){
      return instance.getTeam.call(2);
    }).then(function(newTeam){
      assert.equal(
          newTeam[0],
          0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a7,
          'Team does not return correct players');
      assert.equal(
        newTeam[1],
        0,
        'Team does not have the correct amount of winnings'
      )
    });
  });

  it("Should store the correct owner", function() {
    const accountOne = accounts[0];
    return RushKick.deployed().then(function(instance) {
      return instance.teamOwnerToIndex.call(accountOne);
    })
    .then(function(teamId) {
      assert.equal(teamId.toNumber(), 1, 'Correct owner is not stored.');
    });
  });

  it("Should allow update by team owner", function() {
    const accountTwo = accounts[1];
    const update = 0x282dc71d883a650a39438cd659d3f78afee11c20bc132d308e415da0b115f4a8;
    let contract;
    return RushKick.deployed().then(function(instance) {
      contract = instance;
      contract.updateTeam(2, update, {value: updateFee, from: accountTwo });
      return contract.getTeam.call(2);
    }).then(function(updatedTeam) {
      assert.equal(updatedTeam[0], update, 'Players are not correctly updated');
    });
  });

  it("Should deny update from non-owner address", function() {
    const accountOne = accounts[0];
    const accountTwo = accounts[1];
    const old = 0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a9;
    const update = 0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a8;
    let contract;
    return RushKick.deployed().then(function(instance) {
      contract = instance;
      contract.teamOwnerToIndex.call(accountOne).then(async function(teamId) {
        await expectThrow(contract.updateTeam.call(teamId, update,
          {from: accountTwo, value: updateFee }));
        return contract.getTeam.call(teamId);
      }).then(function(updatedTeam) {
        assert.equal(updatedTeam[0], old, 'Players are updated while they Should not be');
      });
    });
  });

  it("Should send update event", function() {
    const accountOne = accounts[0];
    const update = 0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a8;
    let contract;
    return RushKick.deployed().then(function(instance) {
      contract = instance;
      contract.teamOwnerToIndex.call(accountOne).then(function(teamId) {
        return contract.updateTeam(teamId, update, {value: updateFee, from: accountOne });
      }).then(function(result) {
        assert.equal(result.logs[0].event, "TeamUpdate", "TeamUpdate event not emitted");
      });
    });
  });

  it("Should reject abnormal winnings update", function() {
    return RushKick.deployed().then( async function(instance) {
      await expectThrow(instance.updateWinnings(1, 400000000000000000));
    });
  });

  it("Should reject winnings update from non COO address", function() {
    // @dev COO address is accounts[0] after init().
    return RushKick.deployed().then( async function(instance) {
      await expectThrow(instance.updateWinnings(1, 100000000000000000, {from: accounts[4]}));
    });
  });

  it("Should update winnings and send event", function() {
    return RushKick.deployed().then(function(instance) {
      return instance.updateWinnings(1, 1000);
    }).then(function(result) {
      assert.equal(result.logs[0].event, "WinningsUpdate", "WinningsUpdate event not emitted");
    });
  })

  it("Should save winnings to team", function() {
    return RushKick.deployed().then(function(instance) {
      return instance.getTeam.call(1).then(function(team) {
        assert.equal(team[1], 1000, 'Winnings were not added to team');
      });
    });
  });

  it("Should reject funds withdrawal from owner before end competition", function() {
    // accounts[0] is owner
    return RushKick.deployed().then(async function(instance) {
      await expectThrow(instance.withdrawWinnings(1, {from: accounts[0]}));
    });
  });

  // @dev: These tests are commented out as `increaseTimeTo` costs A LOT of gas.
  // While developing and running tests this is not ideal, as Ganache needs to be restarted
  // after 2-3 test runs. Also, the above test will fail after increasing the time.
  //
  it("Should accept funds withdrawal from owner and emit event when end competition", function() {
    // accounts[0] is owner
    return RushKick.deployed().then(function(instance) {
      // set the time of test rpc to end of competition ()
      increaseTimeTo(1531746000);
      return instance.withdrawWinnings(1, {from: accounts[0]}).then(function(result) {
        assert.equal(result.logs[0].event, "WinningsWithdrawn",
        "WinningsWithdrawn event not emitted");
      })
    });
  });

  it("Should reject funds withdrawal from non owner", function() {
    // accounts[0] is owner
    return RushKick.deployed().then(async function(instance) {
      await expectThrow(instance.withdrawWinnings(2, {from: accounts[8]}));
    });
  });

  it("Should have no more winnings on the team", function() {
    // accounts[0] is owner
    return RushKick.deployed().then(function(instance) {
      return instance.getTeam.call(1).then(function(team) {
        assert.equal(team[1], 0, 'Winnings were not withdrawn from team');
      });
    });
  });
});
