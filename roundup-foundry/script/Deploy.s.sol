// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/RoundUp.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        RoundUp roundUp = new RoundUp();
        console.log("RoundUp deployed at:", address(roundUp));
        vm.stopBroadcast();
    }
}
