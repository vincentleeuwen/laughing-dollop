pragma solidity ^0.4.18;

contract RushKickAccessControl {
  /*** Access control functionality adapted from CryptoKitties ***/

  // The addresses of the accounts (or contracts) that can execute actions within each roles.
  address public ceoAddress;
  address public cfoAddress;
  address public cooAddress;

  // @dev Keeps track whether the contract is paused. When that is true, most actions are blocked
  bool public paused = false;

  /// @dev Access modifier for CEO-only functionality
  modifier onlyCEO() {
      require(msg.sender == ceoAddress);
      _;
  }

  /// @dev Access modifier for CFO-only functionality
  modifier onlyCFO() {
      require(msg.sender == cfoAddress);
      _;
  }

  /// @dev Access modifier for COO-only functionality
  modifier onlyCOO() {
      require(msg.sender == cooAddress);
      _;
  }

  modifier onlyCLevel() {
      require(
          msg.sender == cooAddress ||
          msg.sender == ceoAddress ||
          msg.sender == cfoAddress
      );
      _;
  }

  /// @dev Assigns a new address to act as the CEO. Only available to the current CEO.
  /// @param _newCEO The address of the new CEO
  function setCEO(address _newCEO) external onlyCEO {
      require(_newCEO != address(0));

      ceoAddress = _newCEO;
  }

  /// @dev Assigns a new address to act as the CFO. Only available to the current CEO.
  /// @param _newCFO The address of the new CFO
  function setCFO(address _newCFO) external onlyCEO {
      require(_newCFO != address(0));

      cfoAddress = _newCFO;
  }

  /// @dev Assigns a new address to act as the COO. Only available to the current CEO.
  /// @param _newCOO The address of the new COO
  function setCOO(address _newCOO) external onlyCEO {
      require(_newCOO != address(0));

      cooAddress = _newCOO;
  }

  /*** Pausable functionality adapted from OpenZeppelin ***/

  /// @dev Modifier to allow actions only when the contract IS NOT paused
  modifier whenNotPaused() {
      require(!paused);
      _;
  }

  /// @dev Modifier to allow actions only when the contract IS paused
  modifier whenPaused {
      require(paused);
      _;
  }

  /// @dev Called by any "C-level" role to pause the contract. Used only when
  ///  a bug or exploit is detected and we need to limit damage.
  function pause() external onlyCLevel whenNotPaused {
      paused = true;
  }

  /// @dev Unpauses the smart contract. Can only be called by the CEO, since
  ///  one reason we may pause the contract is when CFO or COO accounts are
  ///  compromised.
  /// @notice This is public rather than external so it can be called by
  ///  derived contracts.
  function unpause() public onlyCEO whenPaused {
      // can't unpause if contract was upgraded
      paused = false;
  }

}


contract RushKickFundManagement is RushKickAccessControl {

  /// @dev the
  uint256 totalCut = 0;

  /// @dev For every transfer, we take a 2.9% cut. The total amount to cut is stored
  /// in this `totalCut`, and determines the maximum amount that the CFO can withdraw
  /// from the balance of the contract at any given time.
  function _takeCut(uint256 amount) internal {
    // calculate the cut
    uint256 cut = amount / 1000 * 29;
    // add to total amount
    totalCut += cut;
  }

  /// @dev Allow CFO to withdraw a maxiumum of the total cutted funds.
  function withdrawBalance() external onlyCFO {
      uint256 balance = this.balance;
      if (balance > totalCut) {
          var payOut = totalCut;
          totalCut = 0;
          cfoAddress.transfer(payOut);
      }
  }

  /// @dev See the total amount cut. Primariy used for testing.
  function getTotalCut() external view onlyCFO returns (uint256) {
    return totalCut;
  }

  /// @dev See the total contract balance. Primariy used for testing.
  function getContractBalance() external view onlyCFO returns (uint256) {
    uint256 balance = this.balance;
    return balance;
  }

  function getNetBalance() public view returns (uint256) {
    uint netBalance = this.balance - totalCut;
    return netBalance;
  }

  /// @dev Check that sender of addTeam has provided enough ETH
  modifier hasProvidedEntryFee() {
    require(msg.value == 102986611700000000 wei);
    _;
  }

  /// @dev If somebody wants to update their team, we require a donation
  /// to the balance in order to keep the game fair to existing players who don't
  /// change their team. The donation is 1/10 of the entry fee.
  modifier hasProvidedUpdateFee() {
    require(msg.value == 10298661170000000 wei);
    _;
  }
}

contract RushKickTeamManagement is RushKickFundManagement {
  /*** EVENTS ***/
  event TeamCreate(address owner, uint256 id, bytes32 players);
  event TeamUpdate(address owner, uint256 id, bytes32 players);
  event WinningsUpdate(uint256 id, uint256 winnings);
  event WinningsWithdrawn(address owner, uint256 id, uint256 winnings);

  /*** DATA TYPES ***/

  /// @dev The main Team struct. Every team in RushKick is represented by a copy
  ///  of this structure, so great care was taken to ensure that it fits neatly into
  ///  a 256-bit word. Note that the order of the members in this structure
  ///  is important because of the byte-packing rules used by Ethereum.
  ///  Ref: http://solidity.readthedocs.io/en/develop/miscellaneous.html
  struct Team {
    // We use a reference to selected players on a centralized server.
    // it would be much nicer to store this information in the contract, but
    // its simply too expensive with current gas costs. The bytes32 is a sha3
    // hash of the team as its registered in the backend. At closure of the contract,
    // the server will check whether this value aligns with the value registered
    // here in the contract, (too prevent false input via the contract directly).
    bytes32 players;

    // This is the value that will be updated by the backend server before
    // closure of the contract, at the end of the league
    uint256 winnings;

  }

  /*** STORAGE ***/

  /// @dev An array containing the Team struct for all teams in existence. The ID
  ///  of each team is actually an index into this array.
  /// FIXME: Note that ID 0 is invalid.
  Team[] teams;

  /// @dev A mapping from team IDs to the address that owns them. All teams have
  /// some valid owner address, and a owner can only own one team.
  mapping(address => uint256) public teamOwnerToIndex;

  /// @dev Unix timestamp that marks the end of the competition.
  uint256 public endOfCompetition = 1531746000;

  function _createTeam(bytes32 players, address ownerAddress) internal returns (uint256) {
    uint256 newTeamId = teams.push(Team({
        players: players,
        winnings: 0
      })) - 1;
    teamOwnerToIndex[ownerAddress] = newTeamId;

    // Emit the create event
    TeamCreate(msg.sender, newTeamId, players);

    return newTeamId;
  }

  function addTeam(bytes32 players) public payable hasProvidedEntryFee whenNotPaused {
    // @dev: Each owner can only have one team;
    require(teamOwnerToIndex[msg.sender] == 0);

    _takeCut(msg.value);
    _createTeam(players, msg.sender);
  }

  function getTeam(uint256 _id) public view returns (
      bytes32 players,
      uint256 winnings
    ) {
    Team storage team = teams[_id];

    players = bytes32(team.players);
    winnings = uint256(team.winnings);
  }

  function updateTeam(
    uint256 _id,
    bytes32 _players
    ) public payable whenNotPaused hasProvidedUpdateFee {
    // make sure only the rightful owner can update his or her team
    require(teamOwnerToIndex[msg.sender] == _id);

    _takeCut(msg.value);

    // Update the team
    teams[_id].players = _players;

    // Emit the update event
    TeamUpdate(msg.sender, _id, _players);
  }

  function updateWinnings(uint256 _id, uint256 _winnings) external onlyCOO {
    /// @dev Update winnings for each team. In the wrong hands, this function
    /// @dev It is highly unlikely that a team quadruples in value, so block any
    /// attempts at setting winnings higher than that.
    require(_winnings < 400000000000000000);
    // FIXME: Should there be a safety switch on the low end?

    teams[_id].winnings = _winnings;

    // Emit the update event so the backend can register the update
    WinningsUpdate(_id, _winnings);

  }

  function withdrawWinnings(uint256 _teamId) public whenNotPaused {
    // @dev: Make sure competition has ended
    require(now > endOfCompetition);
    // make sure only the rightful owner can withdraw funds
    require(teamOwnerToIndex[msg.sender] == _teamId);

    uint256 winnings = teams[_teamId].winnings;
    if (winnings > 0) {
      teams[_teamId].winnings = 0;

      // Transfer the winnings to the owner of the team
      msg.sender.transfer(winnings);

      // Send out transfer events
      WinningsWithdrawn(msg.sender, _teamId, winnings);
    }
  }
}

contract RushKick is RushKickTeamManagement {

  function RushKick() public {
    // create #0 team.
    _createTeam(0, address(0));

    // the creator of the contract is the initial CEO
    ceoAddress = msg.sender;

    // the creator of the contract is also the initial COO
    cooAddress = msg.sender;

  }
}
