/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.createTable('reports', table => {
        table.increments('id').primary(); // Primary key       
        table.string('reported_user_id').notNullable(); // while one report can have multiple message windows, it can only have one reported user
        table.string('reporting_user_id').notNullable();
        table.bigInteger('reporting_timestamp').notNullable();
        table.string('report_for_whom').nullable();
        table.string('report_to_whom').nullable();
        table.string('report_reason').nullable();
        table.text('report_details').nullable();
        table.enum('reporting_status', ['open', 'submitted', 'pending', 'closed']).nullable();
        /* open: the user starts to redact their reports but has not submitted the report
              submitted: the user has submitted the report and the report is pending review
              pending: the report has been reviewed but waits for further action
              closed: the report has been closed with a decision reached
          */
    });

    await knex.schema.createTable('message_windows', table => {
        table.increments('id').primary();
        table.integer('report_id').unsigned().references('id').inTable('reports');
        table.string('message_id').notNullable(); // the center of the message window
        table.string('channel_id').notNullable();
        table.boolean('is_redacted').defaultTo(false); // whether the message window is redacted
        table.timestamp('created_at').defaultTo(knex.fn.now()); // when the message window is created
    });

    await knex.schema.createTable('messages', table => {
        table.increments('id').primary();
        table.string('message_id').notNullable(); // ID of the message
        table.integer('window_id').unsigned().references('id').inTable('message_windows');
        table.text('content').nullable(); // For text messages
        table.string('author_id').notNullable(); // ID of the user who sent the message
        table.string('author_username').notNullable(); // Username of the user who sent the message
        table.string('author_avatar_url').nullable(); // Avatar URL of the user who sent the message
        table.boolean('author_is_bot').defaultTo(false); // Whether the user who sent the message is a bot
        table.timestamp('timestamp');
    });

    await knex.schema.createTable('attachments', table => {
        table.increments('id').primary(); // Primary key for the attachment
        // Foreign key to the messages table, it is the id of the message but not `message_id`, as the user might redacted the same message differently
        table.integer('database_message_id').unsigned().references('id').inTable('messages'); 
        table.string("filename").notNullable(); // Filename of the attachment (e.g., 'image.png')
        table.string('url').notNullable(); // URL of the attachment
        table.string('content_type').notNullable(); // Type of the attachment (e.g., 'image', 'video')
        table.boolean('ephemeral').defaultTo(false); // Whether the attachment is ephemeral
        table.boolean('is_redacted').defaultTo(false); // Whether the attachment is redacted
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex.schema.dropTable('attachments');
    await knex.schema.dropTable('messages');
    await knex.schema.dropTable('message_windows');
    await knex.schema.dropTable('reports');
    
};
