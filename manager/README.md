Make the application a system service

__Install the service:__ `/etc/systemd/system/buda-manager.service`

```
[Unit]
Description=Buda manager process
After=network.target

[Service]
ExecStart=/home/buda/manager/index.js
Restart=always
User=buda
Group=buda
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=/home/buda

[Install]
WantedBy=multi-user.target
```

__Update services list:__ `systemctl daemon-reload`

__Allow to run at boot:__ `systemctl enable buda-manager`

__Start the service:__ `systemctl start buda-manager`

__Inspect logs in real-time:__ `journalctl --follow -u buda-manager`