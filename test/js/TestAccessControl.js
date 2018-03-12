const RushKick = artifacts.require("RushKick");
import expectThrow from './helpers/expectThrow';

contract('RushKick AccessControl (setters)', function(accounts) {

  let contract;

  // @dev: We create a new contract instance for each test in order to prevent weird
  // sequencing bugs with CEO / COO / CFO addresses. By initializing a new contract for
  // each test, we can always be sure that the current ceoAddress is accounts[0].
  //
  // Found on:
  // https://ethereum.stackexchange.com/questions/15567/truffle-smart-contract-testing-does-not-reset-state
  beforeEach(function() {
     return RushKick.new()
     .then(function(instance) {
        contract = instance;
     });
  });

  // setCEO accept / reject

  it("Accepts updating CEO address by current CEO", function() {
    contract.setCEO(accounts[1], {from: accounts[0]});
      return contract.ceoAddress.call().then(function(address) {
      assert.equal(address, accounts[1],
        "CEO is not able to update the CEO address");
    });
  });

  it("Denies updating CEO address by non-CEO address", async function() {
    const accountOne = accounts[0];
    const accountTwo = accounts[1];
    await expectThrow(contract.setCEO(accountTwo, {from: accountTwo}));
    return contract.ceoAddress.call().then(function(address) {
      assert.equal(address, accountOne,
        "CEO can be updated by non-CEO address");
    });
  });

  // setCFO accept / reject

  it("Accepts updating CFO address by current CEO", function() {
    contract.setCFO(accounts[1], {from: accounts[0]}).then(function() {
      return contract.cfoAddress.call().then(function(address) {
        assert.equal(address, accounts[1], "CEO is not able to update the CFO address");
      });
    });
  });

  it("Denies updating CFO address by non-CEO address", async function() {
    const accountOne = accounts[0];
    const accountTwo = accounts[1];
    await expectThrow(contract.setCFO(accountTwo, {from: accountTwo}));
    return contract.cfoAddress.call().then(function(address) {
      assert.equal(address, 0x0000000000000000000000000000000000000000,
        "CFO can be updated by non-CEO address");
    });
  });

  // setCOO accept / reject

  it("Accepts updating COO address by current CEO", function() {
    contract.setCOO(accounts[1], {from: accounts[0]}).then(function() {
      return contract.cooAddress.call().then(function(address) {
        assert.equal(address, accounts[1],
          "CEO is not able to update the COO address");
      });
    });
  });

  it("Denies updating COO address by non-CEO address", async function() {
    const accountOne = accounts[0];
    const accountTwo = accounts[1];
    await expectThrow(contract.setCOO(accountTwo, {from: accountTwo}));
    return contract.cooAddress.call().then(function(address) {
      assert.equal(address, accountOne, "COO can be updated by non-CEO address");
    });
  });
});

contract('RushKick AccessControl (roles & pause)', function(accounts) {

  // Roles tests
  it("Initializes CEO address properly", function() {
    return RushKick.deployed().then(function(instance) {
      return instance.ceoAddress.call().then(function(address) {
        assert.equal(address, accounts[0],
          "Contract doesnt have correct CEO address");
      });
    });
  });

  it("Initializes COO address properly", function() {
    return RushKick.deployed().then(function(instance) {
      return instance.cooAddress.call().then(function(address) {
        assert.equal(address, accounts[0],
          "Contract doesnt have correct COO address");
        });
    });
  });

  it("Doesn't set CFO address on init()", function() {
    return RushKick.deployed().then(function(instance) {
      return instance.cfoAddress.call().then(function(address) {
        assert.equal(address, 0x0000000000000000000000000000000000000000,
          "Contract doesnt have correct CFO address");
      });
    });
  });

  // @dev Pause tests are moved to seperate class as they don't require the
  // beforeEach() hook usesd in AccessControl role tests.

  it("Initializes unpaused", function() {
    return RushKick.deployed().then(function(instance) {
      return instance.pause.call().then(function(paused) {
        assert.equal(paused, false, "Contract should not be paused after init()");
      });
    });
  });

  it("Should not be pausable when unpaused", function() {
    return RushKick.deployed().then( async function(instance) {
      await expectThrow(instance.unpause());
    });
  });

  it("Should not be pausable by non C-Level address", function() {
    return RushKick.deployed().then( async function(instance) {
      await expectThrow(instance.pause({from: accounts[4]}));
    });
  });

  it("Should be pausable by C-Level address", function() {
    return RushKick.deployed().then(function(instance) {
      instance.pause({from: accounts[0]});
      return instance;
      }).then(function(instance) {
          instance.paused.call().then(function(paused) {
            assert.equal(paused, true, "Contract does not pause")
        });
      });
  });

  // contract is paused because of previous test

  it("should not be unpausable by non-CEO", function() {
    return RushKick.deployed().then( async function(instance) {
      await expectThrow(instance.unpause({from: accounts[1]}));
    });
  });

  it("should be unpausable by CEO", function() {
    return RushKick.deployed().then(function(instance) {
      instance.unpause({from: accounts[0]});
      instance.paused.call().then(function(paused){
        assert.equal(paused, false, "Contract cannot be unpaused by CEO");
      })
    });
  });
});
