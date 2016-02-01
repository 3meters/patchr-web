<?php
  use google\appengine\api\mail\Message;
  /*
   * Email Submit
   * Note: filter_var() requires PHP >= 5.2.0
   */
  if ( isset($_POST['email'])
    && isset($_POST['name'])
    && isset($_POST['subject'])
    && isset($_POST['message'])
    && filter_var($_POST['email'], FILTER_VALIDATE_EMAIL) ) {

    // detect & prevent header injections
    $test = "/(content-type|bcc:|cc:|to:)/i";
    foreach ( $_POST as $key => $val ) {
      if ( preg_match( $test, $val ) ) {
        exit;
      }
    }

    try
    {
      $message = new Message();
      $message->setSender($_POST['email']);
      $message->addTo('jay@3meters.com');
      $message->setSubject($_POST['subject']);
      $message->setTextBody($_POST['message']);
      $message->send();
    } catch (InvalidArgumentException $e) {
      // ...
    }
    //mail( "jay@3meters.com", $_POST['subject'], $_POST['message'], "From:" . $_POST['email'] );
  }
?>