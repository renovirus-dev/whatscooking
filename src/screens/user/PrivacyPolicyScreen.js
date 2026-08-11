// ============================================
// FILE: src/screens/user/PrivacyPolicyScreen.js
// ============================================
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, FONTS, RADIUS } from '../../theme';

const LAST_UPDATED = 'January 2025';
const APP_NAME     = "What's Cooking";
const COMPANY      = "What's Cooking";
const CONTACT      = 'renogooden@outlook.com';
const LOCATION     = 'Jamaica';

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Para = ({ children }) => (
  <Text style={styles.para}>{children}</Text>
);

const Bullet = ({ children }) => (
  <View style={styles.bulletRow}>
    <Text style={styles.bulletDot}>•</Text>
    <Text style={styles.bulletText}>{children}</Text>
  </View>
);

const Bold = ({ children }) => (
  <Text style={styles.bold}>{children}</Text>
);

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function PrivacyPolicyScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SIZES.xl },
        ]}
      >
        {/* ── Header ──────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔒 Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>
            {APP_NAME} — Last Updated {LAST_UPDATED}
          </Text>
        </View>

        {/* ── Intro ───────────────────────── */}
        <Para>
          This Privacy Policy describes how {COMPANY} ("we", "us", or "our")
          collects, uses, stores, and protects your personal information when
          you use the {APP_NAME} mobile application ("App"). By using the App,
          you agree to the collection and use of information in accordance with
          this policy.
        </Para>

        <Para>
          We are committed to protecting your privacy and handling your data
          responsibly. Please read this policy carefully. If you do not agree
          with any part of this policy, please discontinue use of the App
          immediately.
        </Para>

        {/* ── 1 ───────────────────────────── */}
        <Section title="1. Information We Collect">
          <Para>
            We collect the following categories of information when you use
            the App:
          </Para>

          <Bold>1.1 Information You Provide Directly</Bold>
          <Bullet>Full name and email address when you register</Bullet>
          <Bullet>Profile photo (avatar) you choose to upload</Bullet>
          <Bullet>Restaurant name, address, contact details and photos if you are a restaurant owner</Bullet>
          <Bullet>Menu items, prices, descriptions and food images you upload</Bullet>
          <Bullet>Reviews and ratings you submit</Bullet>
          <Bullet>Payment information including payment method (PayPal or bank transfer) and transaction references</Bullet>
          <Bullet>Communications you send to us via email</Bullet>

          <Bold>1.2 Information Collected Automatically</Bold>
          <Bullet>Device type, operating system and app version</Bullet>
          <Bullet>Anonymous usage data including screens viewed and features used</Bullet>
          <Bullet>Search terms entered within the App</Bullet>
          <Bullet>Restaurant pages viewed and time spent on pages</Bullet>
          <Bullet>Actions taken such as calling, getting directions or visiting websites</Bullet>
          <Bullet>Approximate location when you use the "Near Me" feature (only when permission is granted)</Bullet>

          <Bold>1.3 Information from Third Parties</Bold>
          <Bullet>Image hosting data from Cloudinary when you upload photos</Bullet>
          <Bullet>Authentication data from Firebase Authentication</Bullet>
        </Section>

        {/* ── 2 ───────────────────────────── */}
        <Section title="2. How We Use Your Information">
          <Para>We use the information we collect to:</Para>
          <Bullet>Create and manage your account</Bullet>
          <Bullet>Display your restaurant profile and menu to other users</Bullet>
          <Bullet>Process and verify subscription payments</Bullet>
          <Bullet>Send notifications about menu updates and promotions (with your consent)</Bullet>
          <Bullet>Provide analytics to restaurant owners about their performance</Bullet>
          <Bullet>Improve the App based on usage patterns</Bullet>
          <Bullet>Respond to your support requests</Bullet>
          <Bullet>Detect and prevent fraud or abuse</Bullet>
          <Bullet>Comply with legal obligations</Bullet>
        </Section>

        {/* ── 3 ───────────────────────────── */}
        <Section title="3. Images and Media">
          <Bold>3.1 User Uploaded Images</Bold>
          <Para>
            When you upload images to the App — including profile photos,
            restaurant cover photos, logos and menu item photos — these images
            are stored on Cloudinary, a third-party cloud media platform.
            By uploading images you confirm that:
          </Para>
          <Bullet>You own the image or have the legal right to use it</Bullet>
          <Bullet>The image does not infringe any third-party copyright, trademark or other intellectual property rights</Bullet>
          <Bullet>The image does not contain offensive, explicit or illegal content</Bullet>
          <Bullet>You grant us a non-exclusive, royalty-free licence to display the image within the App</Bullet>

          <Bold>3.2 Image Storage and Processing</Bold>
          <Para>
            Images are automatically compressed and optimised before upload.
            Cloudinary may process images for optimisation purposes including
            resizing, format conversion and quality adjustment. Images remain
            stored on Cloudinary servers and are accessible via secure URLs.
          </Para>

          <Bold>3.3 Image Removal</Bold>
          <Para>
            You may request removal of your uploaded images at any time by
            contacting us at {CONTACT}. We will remove images from our
            database promptly. Note that Cloudinary may retain cached copies
            for a short period after deletion.
          </Para>

          <Bold>3.4 We Are Not Responsible For</Bold>
          <Bullet>Images uploaded by other users that you may find offensive</Bullet>
          <Bullet>Copyright violations in images uploaded by restaurant owners or users</Bullet>
          <Bullet>Images shared or downloaded by third parties before removal</Bullet>
        </Section>

        {/* ── 4 ───────────────────────────── */}
        <Section title="4. Payments and Transactions">
          <Bold>4.1 Subscription Payments</Bold>
          <Para>
            {APP_NAME} offers paid subscription plans for restaurant owners.
            Payments are accepted via PayPal and bank transfer (Scotiabank
            Jamaica). We do not store your full payment card details on our
            servers.
          </Para>

          <Bold>4.2 Payment Processing</Bold>
          <Para>
            Bank transfer payments are manually verified by our team.
            PayPal payments are processed by PayPal Holdings Inc. and
            subject to PayPal's own privacy policy and terms of service.
            We are not responsible for any issues arising from PayPal
            processing.
          </Para>

          <Bold>4.3 Transaction Records</Bold>
          <Para>
            We retain records of subscription transactions including:
          </Para>
          <Bullet>Payment method used</Bullet>
          <Bullet>Subscription plan purchased</Bullet>
          <Bullet>Payment date and amount</Bullet>
          <Bullet>Transaction reference or confirmation number</Bullet>

          <Para>
            These records are kept for accounting and fraud prevention
            purposes and may be retained for up to 7 years in accordance
            with financial record-keeping requirements.
          </Para>

          <Bold>4.4 Refund Policy</Bold>
          <Para>
            Subscription fees are non-refundable once a payment has been
            confirmed and the subscription activated. If you believe a
            payment was made in error please contact us within 48 hours
            at {CONTACT}. We will review each case individually.
          </Para>

          <Bold>4.5 Failed or Disputed Payments</Bold>
          <Para>
            If a payment cannot be verified, your subscription will not be
            activated or renewed. We are not liable for any service
            interruption caused by payment failure. We reserve the right
            to suspend or terminate accounts with disputed or fraudulent
            payment activity.
          </Para>
        </Section>

        {/* ── 5 ───────────────────────────── */}
        <Section title="5. Data Storage and Security">
          <Bold>5.1 Where Your Data is Stored</Bold>
          <Para>
            Your data is stored using Google Firebase services including
            Firestore Database and Firebase Authentication. Firebase servers
            are operated by Google LLC and may be located outside of
            {LOCATION}. By using the App you consent to your data being
            transferred to and processed in these locations.
          </Para>

          <Bold>5.2 Security Measures</Bold>
          <Para>
            We implement the following security measures to protect your data:
          </Para>
          <Bullet>All data transmitted between the App and our servers is encrypted using HTTPS/TLS</Bullet>
          <Bullet>Firebase Authentication handles password hashing and secure token management</Bullet>
          <Bullet>Firestore security rules restrict access so users can only access their own data</Bullet>
          <Bullet>Images are served via secure Cloudinary URLs</Bullet>
          <Bullet>Admin access is restricted to authorised personnel only</Bullet>

          <Bold>5.3 Data Breach</Bold>
          <Para>
            In the event of a data breach that affects your personal
            information we will notify affected users within a reasonable
            timeframe and take immediate steps to secure the affected systems.
          </Para>

          <Bold>5.4 Limitations</Bold>
          <Para>
            While we take reasonable steps to protect your data, no method
            of transmission over the internet or method of electronic storage
            is 100% secure. We cannot guarantee absolute security of your
            data and use the App at your own risk.
          </Para>
        </Section>

        {/* ── 6 ───────────────────────────── */}
        <Section title="6. Location Data">
          <Para>
            The App requests access to your device location solely to
            provide the "Near Me" restaurant search feature. Location access
            is optional — you may use the App without granting location
            permission. We do not:
          </Para>
          <Bullet>Store your precise GPS coordinates on our servers</Bullet>
          <Bullet>Track your location in the background</Bullet>
          <Bullet>Share your location with third parties</Bullet>
          <Bullet>Use your location for advertising purposes</Bullet>
          <Para>
            Location permission can be revoked at any time in your device
            settings.
          </Para>
        </Section>

        {/* ── 7 ───────────────────────────── */}
        <Section title="7. Camera and Photo Library">
          <Para>
            The App requests access to your camera and photo library to
            allow you to upload profile photos, restaurant images and
            menu item photos. We do not:
          </Para>
          <Bullet>Access your camera or photo library without your explicit action</Bullet>
          <Bullet>Store photos on your device without your knowledge</Bullet>
          <Bullet>Access any photos other than those you explicitly select</Bullet>
          <Para>
            Camera and photo library permissions can be revoked at any
            time in your device settings. Revoking these permissions will
            prevent you from uploading new images but will not affect
            previously uploaded images.
          </Para>
        </Section>

        {/* ── 8 ───────────────────────────── */}
        <Section title="8. Sharing Your Information">
          <Para>
            We do not sell, trade or rent your personal information to
            third parties. We may share your information only in the
            following circumstances:
          </Para>

          <Bold>8.1 Service Providers</Bold>
          <Para>
            We share data with trusted third-party service providers who
            assist us in operating the App:
          </Para>
          <Bullet>Google Firebase — database, authentication and cloud functions</Bullet>
          <Bullet>Cloudinary — image storage and optimisation</Bullet>
          <Bullet>PayPal — payment processing (where applicable)</Bullet>
          <Bullet>Google Cloud Vision API — menu text recognition (where applicable)</Bullet>

          <Bold>8.2 Legal Requirements</Bold>
          <Para>
            We may disclose your information if required to do so by law
            or in response to valid legal requests from public authorities
            including courts and law enforcement agencies.
          </Para>

          <Bold>8.3 Business Transfer</Bold>
          <Para>
            In the event of a merger, acquisition or sale of all or part
            of our assets, your personal information may be transferred
            as part of that transaction. We will notify you before your
            personal information is transferred and becomes subject to a
            different privacy policy.
          </Para>

          <Bold>8.4 Public Information</Bold>
          <Para>
            Restaurant profiles, menus, photos and reviews are publicly
            visible to all App users including guests who are not logged
            in. Do not include sensitive personal information in your
            public restaurant profile or menu descriptions.
          </Para>
        </Section>

        {/* ── 9 ───────────────────────────── */}
        <Section title="9. Your Rights">
          <Para>
            You have the following rights regarding your personal information:
          </Para>
          <Bullet>
            <Bold>Right to Access</Bold> — You may request a copy of the
            personal data we hold about you
          </Bullet>
          <Bullet>
            <Bold>Right to Correction</Bold> — You may update or correct
            your personal information through the Edit Profile screen
          </Bullet>
          <Bullet>
            <Bold>Right to Deletion</Bold> — You may request deletion of
            your account and associated personal data
          </Bullet>
          <Bullet>
            <Bold>Right to Withdraw Consent</Bold> — You may withdraw
            consent for optional data processing such as notifications
            and location access at any time
          </Bullet>
          <Bullet>
            <Bold>Right to Data Portability</Bold> — You may request
            your data in a portable format
          </Bullet>
          <Para>
            To exercise any of these rights please contact us at {CONTACT}.
            We will respond to all requests within 30 days.
          </Para>
        </Section>

        {/* ── 10 ──────────────────────────── */}
        <Section title="10. Children's Privacy">
          <Para>
            The App is not intended for use by children under the age of
            13. We do not knowingly collect personal information from
            children under 13. If you are a parent or guardian and believe
            your child has provided us with personal information please
            contact us at {CONTACT} and we will delete that information
            immediately.
          </Para>
        </Section>

        {/* ── 11 ──────────────────────────── */}
        <Section title="11. Push Notifications">
          <Para>
            With your permission we may send push notifications to your
            device about menu updates, daily specials and promotions.
            You can opt out of push notifications at any time through
            your device settings or within the App under
            Profile → Notifications. Opting out of notifications does
            not affect your ability to use the App.
          </Para>
        </Section>

        {/* ── 12 ──────────────────────────── */}
        <Section title="12. Analytics">
          <Para>
            We collect anonymous analytics data to understand how the App
            is used and to improve our services. This includes:
          </Para>
          <Bullet>Pages and features accessed</Bullet>
          <Bullet>Search terms used</Bullet>
          <Bullet>Time spent on restaurant pages</Bullet>
          <Bullet>Actions taken such as calls and directions requests</Bullet>
          <Para>
            Analytics data is associated with an anonymous identifier and
            is not linked to your name or email address unless you are
            logged in, in which case it may be associated with your user
            ID for the purpose of providing restaurant owners with accurate
            analytics about their business performance.
          </Para>
        </Section>

        {/* ── 13 ──────────────────────────── */}
        <Section title="13. Restaurant Owner Responsibilities">
          <Para>
            If you use the App as a restaurant owner you agree that:
          </Para>
          <Bullet>All information you provide about your restaurant is accurate and not misleading</Bullet>
          <Bullet>All images you upload belong to you or you have permission to use them</Bullet>
          <Bullet>Menu prices displayed in the App are accurate and up to date</Bullet>
          <Bullet>You will not upload images containing offensive, explicit or illegal content</Bullet>
          <Bullet>You are responsible for maintaining the accuracy of your restaurant information</Bullet>
          <Bullet>You understand that your restaurant profile is publicly visible to all App users</Bullet>
          <Bullet>Subscription fees are your responsibility and non-payment may result in account suspension</Bullet>

          <Para>
            We reserve the right to remove any restaurant listing that
            violates these terms or contains inaccurate, misleading or
            inappropriate content without prior notice.
          </Para>
        </Section>

        {/* ── 14 ──────────────────────────── */}
        <Section title="14. Disclaimer of Warranties">
          <Para>
            The App is provided on an "as is" and "as available" basis
            without warranties of any kind, either express or implied.
            We do not warrant that:
          </Para>
          <Bullet>The App will be uninterrupted or error-free</Bullet>
          <Bullet>Restaurant information including menus and prices displayed in the App is always accurate or current</Bullet>
          <Bullet>The App will meet your specific requirements</Bullet>
          <Bullet>Any errors in the App will be corrected</Bullet>
          <Para>
            We are not responsible for the accuracy of restaurant menus,
            prices, opening hours or any other information provided by
            restaurant owners. Always confirm details directly with the
            restaurant before visiting.
          </Para>
        </Section>

        {/* ── 15 ──────────────────────────── */}
        <Section title="15. Limitation of Liability">
          <Para>
            To the maximum extent permitted by applicable law, {COMPANY}
            shall not be liable for any indirect, incidental, special,
            consequential or punitive damages including but not limited to:
          </Para>
          <Bullet>Loss of profits or revenue</Bullet>
          <Bullet>Loss of data or business information</Bullet>
          <Bullet>Any damages arising from reliance on restaurant information displayed in the App</Bullet>
          <Bullet>Any damages arising from unauthorised access to your account</Bullet>
          <Bullet>Any damages arising from third-party payment processing</Bullet>
          <Bullet>Any indirect loss suffered by restaurant owners due to App downtime</Bullet>
          <Para>
            Our total liability to you for any claims arising from your
            use of the App shall not exceed the amount you paid us in
            subscription fees in the 3 months preceding the claim.
          </Para>
        </Section>

        {/* ── 16 ──────────────────────────── */}
        <Section title="16. Governing Law">
          <Para>
            This Privacy Policy and any disputes arising from it shall
            be governed by and construed in accordance with the laws of
            {LOCATION}. Any legal action arising from this policy shall
            be brought exclusively in the courts of {LOCATION}.
          </Para>
        </Section>

        {/* ── 17 ──────────────────────────── */}
        <Section title="17. Changes to This Policy">
          <Para>
            We reserve the right to update this Privacy Policy at any
            time. We will notify you of significant changes by:
          </Para>
          <Bullet>Posting the updated policy in the App</Bullet>
          <Bullet>Sending a push notification if you have notifications enabled</Bullet>
          <Bullet>Updating the "Last Updated" date at the top of this policy</Bullet>
          <Para>
            Your continued use of the App after changes are posted
            constitutes your acceptance of the revised policy. We
            encourage you to review this policy periodically.
          </Para>
        </Section>

        {/* ── 18 ──────────────────────────── */}
        <Section title="18. Account Termination">
          <Para>
            We reserve the right to suspend or terminate your account
            at our sole discretion without notice if we believe you have:
          </Para>
          <Bullet>Violated these terms or our privacy policy</Bullet>
          <Bullet>Provided false or misleading information</Bullet>
          <Bullet>Uploaded inappropriate or illegal content</Bullet>
          <Bullet>Engaged in fraudulent payment activity</Bullet>
          <Bullet>Attempted to harm or disrupt the App or other users</Bullet>
          <Para>
            Upon termination your right to use the App ceases immediately.
            We may retain certain data as required by law or for legitimate
            business purposes.
          </Para>
        </Section>

        {/* ── 19 ──────────────────────────── */}
        <Section title="19. Contact Us">
          <Para>
            If you have any questions, concerns or requests regarding
            this Privacy Policy or your personal data please contact us:
          </Para>
          <Bullet>Email: {CONTACT}</Bullet>
          <Bullet>App: {APP_NAME}</Bullet>
          <Bullet>Location: {LOCATION}</Bullet>
          <Para>
            We will respond to all privacy-related enquiries within
            30 business days.
          </Para>
        </Section>

        {/* ── Footer ──────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using {APP_NAME} you acknowledge that you have read,
            understood and agree to this Privacy Policy.
          </Text>
          <Text style={styles.footerDate}>
            Last Updated: {LAST_UPDATED}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SIZES.lg,
    gap:     SIZES.md,
  },

  // ── Header ────────────────────────────────
  header: {
    backgroundColor: COLORS.primary,
    padding:         SIZES.lg,
    borderRadius:    RADIUS.xl,
    alignItems:      'center',
    gap:             SIZES.xs,
    marginBottom:    SIZES.sm,
  },
  headerTitle: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: FONTS.sm,
    color:    'rgba(255,255,255,0.8)',
  },

  // ── Section ───────────────────────────────
  section: {
    gap:             SIZES.sm,
    backgroundColor: COLORS.surface,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  sectionTitle: {
    fontSize:     FONTS.lg,
    fontWeight:   'bold',
    color:        COLORS.text,
    marginBottom: SIZES.xs,
  },

  // ── Text ──────────────────────────────────
  para: {
    fontSize:   FONTS.md,
    color:      COLORS.textLight,
    lineHeight: 24,
  },
  bold: {
    fontSize:   FONTS.md,
    fontWeight: '700',
    color:      COLORS.text,
    marginTop:  SIZES.xs,
  },

  // ── Bullet ────────────────────────────────
  bulletRow: {
    flexDirection: 'row',
    gap:           SIZES.sm,
    paddingLeft:   SIZES.sm,
  },
  bulletDot: {
    fontSize:  FONTS.md,
    color:     COLORS.primary,
    marginTop: 2,
  },
  bulletText: {
    flex:       1,
    fontSize:   FONTS.md,
    color:      COLORS.textLight,
    lineHeight: 22,
  },

  // ── Footer ────────────────────────────────
  footer: {
    backgroundColor: COLORS.border,
    padding:         SIZES.lg,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
    alignItems:      'center',
    marginTop:       SIZES.md,
  },
  footerText: {
    fontSize:   FONTS.sm,
    color:      COLORS.textMuted,
    textAlign:  'center',
    lineHeight: 20,
    fontStyle:  'italic',
  },
  footerDate: {
    fontSize:   FONTS.xs,
    color:      COLORS.textMuted,
    fontWeight: '600',
  },
});