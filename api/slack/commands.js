module.exports = async (req, res) => {
  const { command, text, user_id, channel_id } = req.body;

  console.log('Slash command received:', command, 'from user:', user_id);

  let responseText = '';

  switch (command) {
    case '/admin-help':
      responseText = `*Admin Commands:*

/admin-update <json> - Update entire program info with JSON
/add-resource <type> <url> <description> - Add a new resource (type: deck, document, spreadsheet)
/update-zoom <mina|mona> <link> - Update advisor zoom link
/admin-help - Show this help message

*User Commands:*

/feedback <your feedback> - Submit feedback about the program or workshop

*Example:*
/add-resource deck https://docs.google.com/presentation/d/xyz "2026 Workshop 1 Deck"`;
      break;

    case '/feedback':
      const feedback = text ? text.trim() : '';
      if (!feedback) {
        responseText = 'Please provide your feedback. Usage: /feedback <your feedback>';
      } else {
        console.log('Feedback received:', feedback);
        responseText = `✅ Thank you for your feedback! We've received: "${feedback}"\n\nYour input helps us improve the program for everyone.`;
      }
      break;

    default:
      responseText = `Unknown command: ${command}. Use /admin-help for available commands.`;
  }

  res.status(200).json({ text: responseText });
};
