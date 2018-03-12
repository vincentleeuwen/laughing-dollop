const RushKick = artifacts.require("RushKick");
import expectThrow from './helpers/expectThrow';

contract('RushKick FundManagement', function(accounts) {
  it("Should reject too low entry fee", function() {
    return RushKick.deployed().then( async function(instance) {
      await expectThrow(instance.addTeam(
        0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a9,
        { value: 10000 }));
    });
  });

  it("Should reject too high entry fee", function() {
    return RushKick.deployed().then( async function(instance) {
      await expectThrow(instance.addTeam(
        0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a9,
        { value: 102986611800000000 }));
    });
  });

  it("Should update balance and totalCut", function() {
    return RushKick.deployed().then(function(instance) {
      instance.addTeam(
        0x282dc71d883a650a39438cd659d3f78af9011c20bc132d308e415da0b115f4a9,
        { value: 102986611700000000 });
      instance.setCFO(accounts[1], {from: accounts[0]});
      return instance;
    }).then( function(instance) {
      instance.getContractBalance.call({from: accounts[1]}).then( function(balance) {
        assert.equal(balance, 102986611700000000, 'Not all payable ETH was added to balance');
      });
      instance.getTotalCut.call({from: accounts[1]}).then(function(totalCut){
        assert.equal(totalCut, 2986611739300000, 'Cut was not taken');
      });
    });
  });

  it("Should make profits withdrawable by CFO", function() {
    const startingBalance = 102986611700000000;
    const totalCut = 2986611739300000;
    const expectedBalance = startingBalance - totalCut;
    return RushKick.deployed().then(function(instance) {
      instance.withdrawBalance({from: accounts[1]});
      return instance;
    }).then(function(instance){
      instance.getContractBalance.call({from: accounts[1]}).then( function(balance) {
        assert.equal(balance, expectedBalance, 'TotalCut not substracted from balance');
      });
      instance.getTotalCut.call({from: accounts[1]}).then(function(totalCut){
        assert.equal(totalCut, 0, 'Cut was not reset correctly');
      });
    });
  });
});
