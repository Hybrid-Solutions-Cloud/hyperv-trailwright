# VMM bare-metal configuration

In Hosts and provisioning, record each host's starting state, BMC/PXE identity, physical adapters, disk layout and intended OS owner. Link its desired or existing VMM profile, management network, image and Run As references. Review the configuration findings and save the project.

The package contains `project.json`, `environment/hardware.yml`, `plans/host-deployment.json`, host/profile reports and inventory schedules. Desired profiles also produce `handoffs/vmm-profiles/plan.json`. No PowerShell consumer, deployment request or journal is generated. Use these configuration records with your existing automation.

Existing resources and lifecycle choices remain explicit. Normal project downloads preserve all answers; sanitized sharing exports replace private identifiers and are intended for review.
