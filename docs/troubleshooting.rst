.. _troubleshooting:

Troubleshooting
===============
Use this section for common troubleshooting steps.

DO general troubleshooting tips
-------------------------------

- Examine the restnoded failure log at /var/log/restnoded/restnoded.log (this is where DO records error messages)

- Examine the REST response:

  - A 400-level response will carry an error message with it
  - If this message is missing, incorrect, or misleading, please let us know by filing an issue on Github.

|

.. _trouble:

Troubleshooting Index
---------------------
Use this section for specific troubleshooting help.


I'm receiving an error when trying to resend a DO declaration with different VLANs, Self IPs and/or Route Domains
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
If you used DO to initially onboard a BIG-IP and did *not* specify unique (non-default) VLANs, Self IPs, or Route domains, you cannot re-POST a DO declaration to the same BIG-IP using different VLANs, Self IPs or Route Domains.  

This is because when updating the configuration DO attempts to delete the initial configuration, and the default VLAN, Self IPs and Route domains cannot be deleted from the BIG-IP system. This will result in DO trying to rollback, which can fail, resulting in objects being left behind on the BIG-IP device.  This can also occur if you did not use DO to onboard the BIG-IP, but later attempt to use DO to configure VLANs, Self IPs, and/or Route Domains.
 
If you want to onboard with DO and have non-default VLANs, Self IPs, or Route Domains, you must include these objects and values as a part of the initial onboarding declaration.  

This is being tracked by |github54|.


.. |github54| raw:: html

   <a href="https://github.com/F5Networks/f5-declarative-onboarding/issues/56" target="_blank">GitHub issue #56</a>

