Make the application a system service

- __Create user/group/home__

- __Install binaries on PATH__

- __Install the service:__ 

`/etc/systemd/system/buda-manager.service`

- __Update services list:__

`systemctl daemon-reload`

- __Allow to run at boot:__

`
systemctl enable buda-manager`

- __Start the service:__

`
systemctl start buda-manager`

- __Inspect logs in real-time:__

`journalctl --follow -u buda-manager`