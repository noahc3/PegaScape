/* PegaSwitch nspwn script to replace exefs with any arbitrary exefs nsp, load nsp homebrew like reboot_to_rcm, etc */
/* Originally posted by TuxSH on RS #switch-hacking-general */

sc.getServices(["lr"], function (lr) {
    var path = utils.str2ab("@Sdcard:/hbl.nsp"); /* put hbl.nsp on your SD card root */
    var tid  = [0x100D, 0x01000000];        /* TID of album */
    var storageId = 3;                      /* NAND (location of the Album applet) */

    var msg = sc.ipcMsg(0).data(storageId).sendTo(lr).assertOk(); /* nn::lr::ILocationResolverManager(StorageId storageId) => nn::lr::ILocationResolver */
    sc.withHandle(msg.movedHandles[0], (h) => {                   /* nn::lr::ILocationResolver::SetProgramNcaPath(u64 TID, const char *path) */
        msg = sc.ipcMsg(1).data(tid).xDescriptor(path, path.byteLength, 0).sendTo(h).assertOk();
    });
});

/* This script does not launch automatically. After running the exploit, hide the script icons and unhide the message telling the user to launch album  */
window.showAlbumMessage();