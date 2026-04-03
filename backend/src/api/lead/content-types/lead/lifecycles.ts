export default {
  async afterCreate(event) {
    const { result } = event;

    try {
      await strapi
        .plugin('email')
        .service('email')
        .send({
          to: 'owner@noorenterprises.com', // Replace with actual business owner email
          from: 'system@noorenterprises.com', // Must be a verified sender in SendGrid
          subject: 'New Website Lead Captured!',
          text: `A new lead has been submitted:\n\nName: ${result.Name}\nPhone: ${result.PhoneNumber}\n\nPlease check the Strapi Admin Panel for details.`,
        });
    } catch (err) {
      console.error('Failed to send lead notification email:', err);
    }
  },
};
