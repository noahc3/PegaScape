/* PegaSwitch nspwn script to replace exefs with any arbitrary exefs nsp, load nsp homebrew like reboot_to_rcm, etc */
/* Originally posted by TuxSH on RS #switch-hacking-general */

sc.getServices(["lr"], function (lr) {
    var path = utils.str2ab("@Sdcard:/pegascape/caffeine.nsp"); /* put nereba.nsp on your SD card root */
    var tid  = [0x1008, 0x01000000];        /* TID of swkbd */
    var storageId = 3;                      /* NAND (location of the swkbd applet) */

    var msg = sc.ipcMsg(0).data(storageId).sendTo(lr).assertOk(); /* nn::lr::ILocationResolverManager(StorageId storageId) => nn::lr::ILocationResolver */
    sc.withHandle(msg.movedHandles[0], (h) => {                   /* nn::lr::ILocationResolver::SetProgramNcaPath(u64 TID, const char *path) */
        msg = sc.ipcMsg(1).data(tid).xDescriptor(path, path.byteLength, 0).sendTo(h).assertOk();
        prompt("Tap the text field below, wait three seconds, then tap the power button.");
    });
});

//prompt("test");

//sc.ipcMsg(0).datau64(0, utils.parseAddr('0x0100000000001008'), 3).sendTo('pm:shell').assertOk(); /* launch swkbd through pm:shell to execute custom exefs, essentially auto-executing the payload */