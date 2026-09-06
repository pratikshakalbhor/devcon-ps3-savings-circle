// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Test ERC-20 used as CONTRIBUTION_TOKEN_ADDRESS in local builds.
 *
 * Deploy it (e.g. via Foundry: `forge create --rpc-url $RPC_URL ...`) and point
 * CONTRIBUTION_TOKEN_ADDRESS at the deployed address. The committed policy
 * allows this as the ONLY source asset for weekly pot contributions.
 */
contract TestToken {
    string public name = "devcon-ps3 test token";
    string public symbol = "PS3";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;

    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        _mint(msg.sender, initialSupply * 10 ** decimals);
    }

    /// Owner-only mint for topping up member balances during testing.
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "TestToken: only owner");
        _mint(to, amount);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "TestToken: insufficient allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "TestToken: transfer to zero address");
        require(balanceOf[from] >= value, "TestToken: insufficient balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }
}