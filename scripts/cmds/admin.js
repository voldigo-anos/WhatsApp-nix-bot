const { readFile, writeFile } = require("fs-extra");
const path = require("path");
const { box, bold } = require("../../func/style.js");

const CONFIG_PATH = path.resolve(process.cwd(), "config.json");

const cleanUid = (uid) => uid.split(":")[0].split("@")[0];

const isValidJID = (uid) => {
    if (!uid || typeof uid !== "string") return false;
    const jidPattern = /^\d+@(s\.whatsapp\.net|lid)$/;
    if (jidPattern.test(uid)) return true;
    const [number] = uid.split("@");
    return !isNaN(number) && number.length > 6;
};

const normalizeJID = (uid) => {
    if (!uid) return null;
    if (isValidJID(uid) && uid.includes("@")) return uid;
    const [number] = uid.split("@");
    if (!isNaN(number) && number.length > 6) return `${number}@s.whatsapp.net`;
    return null;
};

module.exports = {
    config: {
        name: "admin",
        aliases: ["adm"],
        version: "0.0.1",
        author: "ArYAN",
        countDown: 5,
        role: 2,
        description: {
            en: "Manage bot admins (role 2) with instant updates"
        },
        category: "owner",
        nixPrefix: true,
        guide: {
            en: "   {pn} [add | -a] <uid | @tag>: Add admin role for user"
                + "\n   {pn} [remove | -r] <uid | @tag>: Remove admin role of user"
                + "\n   {pn} [list | -l]: List all admins"
        }
    },

    onStart: async function ({ sock, chatId, args, event, getLang, prefix, isGroup }) {
        let config;
        try {
            const data = await readFile(CONFIG_PATH, "utf8");
            config = JSON.parse(data);
            if (!config.roles || !config.roles["2"]) config.roles = { ...config.roles, "2": [] };
        } catch (error) {
            return sock.sendMessage(chatId, { text: box({ title: "Admin", emoji: "⚠️", body: "Erreur : Impossible de charger la configuration." }) }, { quoted: event });
        }

        const saveConfig = async () => {
            try {
                await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
                global.NixBot.config = config;
            } catch (error) {
                await sock.sendMessage(chatId, { text: box({ title: "Admin", emoji: "⚠️", body: "Erreur : Impossible d'enregistrer les changements." }) }, { quoted: event });
            }
        };

        let groupParticipants = null;
        if (isGroup) {
            try {
                const groupMeta = await sock.groupMetadata(chatId);
                groupParticipants = groupMeta.participants;
            } catch (e) {}
        }

        const getNameAndJid = async (uid) => {
            const clean = cleanUid(uid);
            if (groupParticipants) {
                for (const p of groupParticipants) {
                    if (cleanUid(p.id) === clean) {
                        return { name: p.notify || p.verifiedName || p.name || null, jid: p.id };
                    }
                }
            }
            try {
                const groups = await sock.groupFetchAllParticipating();
                for (const gid in groups) {
                    const group = groups[gid];
                    if (group.participants) {
                        for (const p of group.participants) {
                            if (cleanUid(p.id) === clean) {
                                return { name: p.notify || p.verifiedName || p.name || null, jid: p.id };
                            }
                        }
                    }
                }
            } catch (e) {}
            return { name: null, jid: getMentionJid(uid) };
        };

        const extractUIDs = () => {
            let uids = [];
            const mentionedJid = event.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentionedJid && Array.isArray(mentionedJid) && mentionedJid.length > 0) {
                uids = mentionedJid.filter(isValidJID);
            }
            if (!uids.length && event.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const contextInfo = event.message.extendedTextMessage.contextInfo;
                const quotedJid = contextInfo.participant || null;
                if (quotedJid && isValidJID(quotedJid)) {
                    uids.push(quotedJid);
                }
            }
            if (!uids.length && args.length > 1) {
                uids = args.slice(1).map(normalizeJID).filter((uid) => uid);
            }
            return uids.length > 0 ? uids : null;
        };

        const formatUser = (name, uid) => {
            const clean = cleanUid(uid);
            return name ? `• ${name} (@${clean})` : `• @${clean}`;
        };

        const getMentionJid = (uid) => {
            const clean = cleanUid(uid);
            if (uid.includes("@")) return uid;
            return `${clean}@s.whatsapp.net`;
        };

        switch (args[0]?.toLowerCase()) {
            case "add":
            case "-a": {
                const uids = extractUIDs();
                if (!uids) {
                    return sock.sendMessage(chatId, { text: box({ title: "Admin", emoji: "⚠️", body: "Veuillez taguer un utilisateur, répondre à un message, ou fournir un UID." }) }, { quoted: event });
                }

                const notAdminIds = [];
                const adminIds = [];
                for (const uid of uids) {
                    const clean = cleanUid(uid);
                    if (config.roles["2"].includes(clean)) {
                        adminIds.push(uid);
                    } else {
                        notAdminIds.push(uid);
                        config.roles["2"].push(clean);
                    }
                }

                if (notAdminIds.length > 0) await saveConfig();

                const resolved = await Promise.all(
                    uids.map(async (uid) => {
                        const info = await getNameAndJid(uid);
                        return { uid, name: info.name, jid: info.jid };
                    })
                );

                let body = "";
                const allMentions = resolved.map(u => u.jid);
                if (notAdminIds.length > 0) {
                    const lines = resolved
                        .filter(u => notAdminIds.includes(u.uid))
                        .map(u => formatUser(u.name, u.uid));
                    body += `✅ ${bold("Rôle admin ajouté pour")} ${notAdminIds.length} utilisateur(s) :\n${lines.join("\n")}`;
                }
                if (adminIds.length > 0) {
                    const lines = resolved
                        .filter(u => adminIds.includes(u.uid))
                        .map(u => formatUser(u.name, u.uid));
                    body += (body ? "\n" : "") + `⚠️ ${bold("Déjà admin")} (${adminIds.length}) :\n${lines.join("\n")}`;
                }

                return sock.sendMessage(chatId, {
                    text: box({ title: "Admin", emoji: "👑", body: body || "⚠️ Aucun changement effectué." }),
                    mentions: allMentions
                }, { quoted: event });
            }

            case "remove":
            case "-r": {
                const uids = extractUIDs();
                if (!uids) {
                    return sock.sendMessage(chatId, { text: box({ title: "Admin", emoji: "⚠️", body: "Veuillez taguer un utilisateur, répondre à un message, ou fournir un UID." }) }, { quoted: event });
                }

                const removedIds = [];
                const notAdminIds = [];
                for (const uid of uids) {
                    const clean = cleanUid(uid);
                    const idx = config.roles["2"].indexOf(clean);
                    if (idx !== -1) {
                        config.roles["2"].splice(idx, 1);
                        removedIds.push(uid);
                    } else {
                        notAdminIds.push(uid);
                    }
                }

                if (removedIds.length > 0) await saveConfig();

                const resolved = await Promise.all(
                    uids.map(async (uid) => {
                        const info = await getNameAndJid(uid);
                        return { uid, name: info.name, jid: info.jid };
                    })
                );

                let body = "";
                const allMentions = resolved.map(u => u.jid);
                if (removedIds.length > 0) {
                    const lines = resolved
                        .filter(u => removedIds.includes(u.uid))
                        .map(u => formatUser(u.name, u.uid));
                    body += `✅ ${bold("Rôle admin retiré pour")} ${removedIds.length} utilisateur(s) :\n${lines.join("\n")}`;
                }
                if (notAdminIds.length > 0) {
                    const lines = resolved
                        .filter(u => notAdminIds.includes(u.uid))
                        .map(u => formatUser(u.name, u.uid));
                    body += (body ? "\n" : "") + `⚠️ ${bold("N'ont pas le rôle admin")} (${notAdminIds.length}) :\n${lines.join("\n")}`;
                }

                return sock.sendMessage(chatId, {
                    text: box({ title: "Admin", emoji: "👑", body: body || "⚠️ Aucun changement effectué." }),
                    mentions: allMentions
                }, { quoted: event });
            }

            case "list":
            case "-l": {
                if (config.roles["2"].length === 0) {
                    return sock.sendMessage(chatId, { text: box({ title: "Admin", emoji: "👑", body: "Aucun admin trouvé." }) }, { quoted: event });
                }

                const resolved = await Promise.all(
                    config.roles["2"].map(async (uid) => {
                        const info = await getNameAndJid(uid);
                        return { uid, name: info.name, jid: info.jid };
                    })
                );

                const mentions = resolved.map(u => u.jid);
                const body = resolved.map(u => formatUser(u.name, u.uid)).join("\n");

                return sock.sendMessage(chatId, { text: box({ title: "Admin", emoji: "👑", body: `${bold("Liste des admins")} :\n${body}` }), mentions }, { quoted: event });
            }

            default:
                return sock.sendMessage(chatId, { text: getLang ? getLang('handlerEvents.commandSyntaxError', prefix, 'admin') : box({ title: "Admin", emoji: "⚠️", body: `Syntaxe invalide. Utilisez ${prefix}admin add|remove|list.` }) }, { quoted: event });
        }
    }
};
