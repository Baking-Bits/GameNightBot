const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DataProtection = require('../utils/dataProtection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('databackup')
        .setDescription('Data backup and protection utilities (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create manual backup of all data')
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for backup (e.g., "before-update", "manual-save")')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List available backups for a data file')
                .addStringOption(option =>
                    option
                        .setName('file')
                        .setDescription('Data file to check')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Meal History', value: 'mealHistory.json' },
                            { name: 'Workout History', value: 'workoutHistory.json' },
                            { name: 'Snack History', value: 'snackHistory.json' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restore from backup (USE WITH CAUTION)')
                .addStringOption(option =>
                    option
                        .setName('file')
                        .setDescription('Data file to restore')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Meal History', value: 'mealHistory.json' },
                            { name: 'Workout History', value: 'workoutHistory.json' },
                            { name: 'Snack History', value: 'snackHistory.json' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('timestamp')
                        .setDescription('Backup timestamp (use /databackup list to find)')
                        .setRequired(true)
                )
        ),

    async execute(interaction, bot) {
        // Check if user has admin permissions
        const isAdmin = bot.config.adminRoles?.some(roleId => 
            interaction.member?.roles.cache.has(roleId)
        );

        if (!isAdmin) {
            await interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const dataProtection = new DataProtection('./data');

        try {
            await dataProtection.initialize();

            switch (subcommand) {
                case 'create':
                    await handleCreateBackup(interaction, dataProtection);
                    break;
                case 'list':
                    await handleListBackups(interaction, dataProtection);
                    break;
                case 'restore':
                    await handleRestore(interaction, dataProtection);
                    break;
            }
        } catch (error) {
            console.error('Error in databackup command:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the backup command.',
                ephemeral: true
            });
        }
    }
};

async function handleCreateBackup(interaction, dataProtection) {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.options.getString('reason') || 'manual';
    
    const results = await dataProtection.backupAll(reason);
    
    const embed = new EmbedBuilder()
        .setTitle('📦 Backup Created')
        .setColor('#4CAF50')
        .setTimestamp();

    let description = '';
    let backupCount = 0;

    for (const [filename, backupPath] of Object.entries(results)) {
        if (backupPath) {
            description += `✅ ${filename}: Backed up\n`;
            backupCount++;
        } else {
            description += `⚠️ ${filename}: Skipped (no data or test data only)\n`;
        }
    }

    embed.setDescription(description);
    embed.addFields({ name: 'Reason', value: reason, inline: true });
    embed.addFields({ name: 'Files Backed Up', value: backupCount.toString(), inline: true });

    await interaction.editReply({ embeds: [embed] });
}

async function handleListBackups(interaction, dataProtection) {
    await interaction.deferReply({ ephemeral: true });

    const filename = interaction.options.getString('file');
    const backups = await dataProtection.listBackups(filename);

    const embed = new EmbedBuilder()
        .setTitle(`📋 Backups for ${filename}`)
        .setColor('#2196F3')
        .setTimestamp();

    if (backups.length === 0) {
        embed.setDescription('No backups found for this file.');
    } else {
        let description = '';
        backups.slice(0, 15).forEach((backup, index) => {
            const date = backup.timestamp.replace(/T/, ' ').replace(/-/g, ':').replace('Z', '');
            description += `**${index + 1}.** ${date}\n`;
            description += `   Reason: ${backup.reason}\n`;
            description += `   File: \`${backup.filename}\`\n\n`;
        });

        if (backups.length > 15) {
            description += `... and ${backups.length - 15} more backups`;
        }

        embed.setDescription(description);
    }

    embed.addFields({ name: 'Total Backups', value: backups.length.toString(), inline: true });

    await interaction.editReply({ embeds: [embed] });
}

async function handleRestore(interaction, dataProtection) {
    await interaction.deferReply({ ephemeral: true });

    const filename = interaction.options.getString('file');
    const timestamp = interaction.options.getString('timestamp');

    // Add confirmation warning
    const embed = new EmbedBuilder()
        .setTitle('⚠️ RESTORE CONFIRMATION REQUIRED')
        .setDescription(`You are about to restore **${filename}** from backup.\n\n**THIS WILL OVERWRITE ALL CURRENT DATA!**\n\nCurrent data will be backed up before restore.`)
        .setColor('#FF9800')
        .addFields(
            { name: 'File', value: filename, inline: true },
            { name: 'Backup Timestamp', value: timestamp, inline: true },
            { name: '⚠️ Warning', value: 'This action cannot be easily undone!', inline: false }
        );

    await interaction.editReply({ 
        embeds: [embed],
        content: '**Reply with "CONFIRM RESTORE" to proceed, or ignore to cancel.**'
    });

    // Note: In a full implementation, you'd want to add a follow-up collector here
    // to wait for user confirmation before actually performing the restore
}
